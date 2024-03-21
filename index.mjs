import dotenv from "dotenv";
import express from "express";
import { generateJbcKeysStream } from "./generate_key.mjs";

dotenv.config();


const app = express();
const port = process.env.PORT || 3000;

app.post("/generate-keys",
  express.json(), express.urlencoded({ extended: true }),
  async (req, res, next) => {
    const archive = generateJbcKeysStream(
      parseInt(req.body.qty, 10),
      req.body.withdrawAddress,
      req.body.keyPassword,
    (err) => {
      console.error(err);
      res.status(500).json({
        status: "Error",
        message: err.message
      })
    });
    res.status(200).attachment("zip.zip");
    archive.pipe(res);
});

app.get("/", (req, res) => {
  res.status(200).send("Server OK");
});

app.listen(port, () => {
  console.log(`Server Start at port ${port}`)  
})
