const fetch = require("node-fetch");

module.exports = {
  dropUsers: async (parent, args, { db }) => {
    const result = await db.collection("users").drop((err, delOK) => {
      if (err) throw err;
      if (delOK) {
        console.log("Users Deleted.");
        return true;
      }
    });
  },
  fakeUserAuth: async (parent, { githubLogin }, { db }) => {
    const user = await db.collection("users").findOne({ githubLogin });
    if (!user) {
      throw new Error(`Cannot find user with githubLogin ${githubLogin}`);
    }
    return {
      token: user.githubToken,
      user
    };
  },
  addFakeUsers: async (root, { count }, { db, pubsub }) => {
    const randomUserApi = `https://randomuser.me/api/?results=${count}`;
    const { results } = await fetch(randomUserApi).then(res => res.json());
    const users = results.map(r => ({
      githubLogin: r.login.username,
      name: `${r.name.first} ${r.name.last}`,
      avatar: r.picture.thumbnail,
      githubToken: r.login.sha1
    }));
    const { insertedIds } = await db.collection("users").insert(users);
    users.forEach((newUser, i) => {
      newUser.id = insertedIds[i];
      pubsub.publish("user-added", { newUser });
    });

    return users;
  },
  postPhoto: async (parent, args, { db, currentUser, pubsub }) => {
    if (!currentUser) {
      throw new Error("only an authorized user can post a photo");
    }
    const newPhoto = {
      ...args.input,
      userID: currentUser.githubLogin,
      created: new Date()
    };
    const { insertedIds } = await db.collection("photos").insert(newPhoto);
    newPhoto.id = insertedIds[0];
    pubsub.publish("photo-added", { newPhoto });
    return newPhoto;
  },
  async githubAuth(parent, { code }, { db }) {
    let {
      message,
      access_token,
      avatar_url,
      login,
      name
    } = await authorizeWithGithub({
      client_id: "2a492151a488e8f69408",
      client_secret: "09e6edf3c4219075c65ceb7f39c0e5faabe0f8b5",
      code: code
    });

    if (message) {
      throw new Error(message);
    }

    let latestUserInfo = {
      name,
      githubLogin: login,
      githubToken: access_token,
      avatar: avatar_url
    };

    const {
      ops: [user]
    } = await db
      .collection("users")
      .replaceOne({ githubLogin: login }, latestUserInfo, { upsert: true });

    return { user, token: access_token };
  }
};
