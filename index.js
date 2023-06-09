const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);
const path = require("path");

const bodyParser = require("body-parser");
const cookies = require("cookie-parser");
const jwt = require("jsonwebtoken");
var axios = require("axios");
const dotenv = require("dotenv");

// Use dotenv to load environment variables
dotenv.config();

const PORT = process.env.PORT;

// Middleware
app.use(express.static(path.join(__dirname, "public")));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.json());
app.use(cookies());

// Routes
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

app.post("/", (req, res) => {
  const checkkey = req.body.password;
  if (checkkey == "vivek") {
    let jwtSecretKey = process.env.JWT_SECRET_KEY;
    let data = {
      time: Date(),
      key: checkkey,
    };

    const logintoken = jwt.sign(data, jwtSecretKey);
    res
      .cookie("jwtlogin", logintoken, { httpOnly: true, secure: true })
      .status(200)
      .redirect("/username");
  } else {
    res.send("Not authenticated.");
  }
});

app.get("/send-ad", (req, res) => {
  var data = JSON.stringify({
    collection: "adworks",
    database: "iithomegle",
    dataSource: "Cluster0",
    projection: {
      _id: 1,
      hea: 1,
    },
  });

  var config = {
    method: "post",
    url: process.env.mon_ad_end,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Request-Headers": "*",
      "api-key": process.env.mon_URI,
    },
    data: data,
  };

  axios(config)
    .then(function (response) {
      console.log(JSON.stringify(response.data));
      res.send(response.data);
    })
    .catch(function (error) {
      console.log(error);
    });
});

const authorization = (req, res, next) => {
  let token = req.cookies.jwtlogin;
  let jwtSecretKey = process.env.JWT_SECRET_KEY;
  if (!token) {
    return res.redirect("/");
  }
  try {
    const data = jwt.verify(token, jwtSecretKey);
    return next();
  } catch {
    return res.redirect("/");
  }
};

app.post("/username", authorization, (req, res) => {
  const uname = req.body.username;
  let jwtSecretKey2 = process.env.JWT_SECRET_KEY2;
  let data2 = {
    time: Date(),
    username: uname,
  };

  const logintoken = jwt.sign(data2, jwtSecretKey2);
  res
    .cookie("jwtchat", logintoken, { httpOnly: true, secure: true })
    .status(200)
    .redirect("/chat");
});

const authorization2 = (req, res, next) => {
  let token = req.cookies.jwtchat;
  let jwtSecretKey = process.env.JWT_SECRET_KEY2;
  if (!token) {
    return res.redirect("/username");
  }
  try {
    const data = jwt.verify(token, jwtSecretKey);
    return next();
  } catch {
    return res.redirect("/username");
  }
};

app.get("/username", authorization, (req, res) => {
  res.sendFile(path.join(__dirname, "public/username.html"));
});

app.get("/chat", authorization2, (req, res) => {
  res.sendFile(path.join(__dirname, "public/chat.html"));
});

app.get("/get-username", authorization2, (req, res) => {
  const token = req.cookies.jwtchat;
  const jwtSecretKey2 = process.env.JWT_SECRET_KEY2;
  try {
    const decoded = jwt.verify(token, jwtSecretKey2);
    const username = decoded.username;
    res.json({ username: username });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Unable to get username." });
  }
});

const Users = {};

io.on("connection", (socket) => {
  console.log("a user connected");

  socket.on("addUser", (username) => {
    console.log(`Adding user ${username} with id ${socket.id}`);
    Users[socket.id] = username;
    console.log(Users);
  });

  socket.on("joinRoom", (exid) => {
    // console.log(`User with socket id ${socket.id} wants new room`);
    // if (Object.keys(Users).length > 1) {
    //   let randomIndex = Math.floor(Math.random() * Object.keys(Users).length);
    //   let i = 0;
    //   for (let userId in Users) {
    //     if (i === randomIndex && userId !== socket.id) {
    //       let partner1 = Users[userId];
    //       let us = Users[socket.id];
    //       delete Users[socket.id];
    //       delete Users[userId];
    //       socket.emit("foundpartner", { id: userId, name: partner1 });
    //       io.to(userId).emit("foundpartner", {
    //         id: socket.id,
    //         name: us,
    //       });
    //       break;
    //     } else {
    //       socket.emit("wait", exid);
    //       break;
    //     }
    //     i++;
    //   }
    // } else {
    //   // console.log("Waiting");
    //   socket.emit("wait", exid);
    // }
    if (Object.keys(Users).length > 1) {
      for (let userId in Users) {
        if (userId !== exid && userId !== socket.id) {
          let partner1 = Users[userId];
          let us = Users[socket.id];
          delete Users[socket.id];
          delete Users[userId];
          socket.emit("foundpartner", { id: userId, name: partner1 });
          io.to(userId).emit("foundpartner", {
            id: socket.id,
            name: us,
          });
          break;
        }
      }
    } else {
      // console.log("Waiting");
      socket.emit("wait", exid);
    }
  });

  socket.on("sendMessage", ({ toper: opponent, mess: message }) => {
    io.to(opponent).emit("receiveMessage", message);
  });

  socket.on("skipped", (oid) => {
    io.to(oid).emit("skippedu");
  });

  socket.on("disconnect", () => {
    console.log(`User with id ${socket.id} disconnected`);
    delete Users[socket.id];
  });
});

http.listen(PORT, () => {
  console.log(`listening on *:${PORT}`);
});
