import dotenv from "dotenv";
import express from "express";
import { generateJbcKeysStream } from "./generate_key.mjs";

dotenv.config();


const app = express();
const port = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.status(200).send("Server OK");
});

app.post("/generate-keys", express.json(), express.urlencoded({ extended: true }), async (req, res, next) => {
  try {
    const archive = generateJbcKeysStream(req.body.qty, req.body.withdrawAddress, req.body.keyPassword);
    res.status(200).attachment("zip.zip");
    archive.pipe(res);
    
  } catch(err) {
    next(err);
  }
});

app.listen(port, () => {
  console.log(`Server Start at port ${port}`)  
})
