const { GraphQLScalarType } = require("graphql");
const fetch = require("node-fetch");

// let _id = 0;
// const photos = [
//   {
//     id: "1",
//     name: "Dropping the Heart Chute",
//     description: "The heart chute is one of my favorite chutes",
//     category: "ACTION",
//     githubUser: "gPlake",
//     created: "3-28-1977"
//   },
//   {
//     id: "2",
//     name: "Enjoying the sunshine",
//     category: "SELFIE",
//     githubUser: "mHattrup",
//     created: "1-2-1985"
//   },
//   {
//     id: "3",
//     name: "Gunbarrel 25",
//     description: "25 laps on gunbarrel today",
//     category: "LANDSCAPE",
//     githubUser: "sSchmidt",
//     created: "2018-04-15T19:09:57.308z"
//   }
// ];

// const users = [
//   { githubLogin: "mHattrup", name: "Mike Hattrup" },
//   { githubLogin: "gPlake", name: "Glen Plake" },
//   { githubLogin: "sSchmidt", name: "Scot Schmidt" }
// ];

// const tags = [
//   { photoID: "1", userID: "gPlake" },
//   { photoID: "1", userID: "mHattrup" },
//   { photoID: "2", userID: "mHattrup" },
//   { photoID: "2", userID: "sSchmidt" }
// ];
const requestGithubToken = credentials =>
  fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(credentials)
  })
    .then(res => res.json())
    .catch(error => {
      throw new Error(JSON.stringify(error));
    });

const requestGithubUserAccount = token =>
  fetch(`https://api.github.com/user?access_token=${token}`)
    .then(res => res.json())
    .catch(error => {
      throw new Error(JSON.stringify(error));
    });

async function authorizeWithGithub(credentials) {
  const { access_token } = await requestGithubToken(credentials);
  const githubUser = await requestGithubUserAccount(access_token);
  return { ...githubUser, access_token };
}

module.exports = {
  Query: {
    totalPhotos: (parent, args, { db }) =>
      db.collection("photos").estimatedDocumentCount(),
    allPhotos: (parent, args, { db }) =>
      db
        .collection("photos")
        .find()
        .toArray(),
    totalUsers: (parent, args, { db }) =>
      db.collection("users").estimatedDocumentCount(),
    allUsers: (parent, args, { db }) =>
      db
        .collection("users")
        .find()
        .toArray()
  },
  Mutation: {
    postPhoto(parent, args) {
      let newPhoto = {
        id: _id++,
        ...args.input,
        created: new Date()
      };
      photos.push(newPhoto);
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
  },
  Photo: {
    url: parent => `test.com/${parent.id}.jpg`,
    postedBy: parent => {
      return users.find(u => u.githubLogin === parent.githubUser);
    },
    taggedUsers: parent =>
      tags
        .filter(tag => tag.photoID === parent.id)
        .map(tag => tag.userID)
        .map(userID => users.find(u => u.githubLogin === userID))
  },
  User: {
    postedPhotos: parent => {
      return photos.filter(p => p.githubUser === parent.githubLogin);
    },
    inPhotos: parent =>
      tags
        .filter(tag => tag.userID === parent.id)
        .map(tag => tag.photoID)
        .map(photoID => photos.find(p => p.id === photoID))
  },
  DateTime: new GraphQLScalarType({
    name: "DateTime",
    description: "A valid date time value.",
    parseValue: value => new Date(value),
    serialize: value => new Date(value).toISOString(),
    parseLiteral: ast => ast.value
  })
};
