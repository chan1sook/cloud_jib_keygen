import fs from "fs/promises";
import path from "path";
import { spawn } from "child_process";

import archiver from 'archiver';

import colors from "colors"
import { customAlphabet } from "nanoid";
import { fileURLToPath } from "url";

const sessionGen = customAlphabet("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz", 21);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const baseTempPath = process.env.JBC_KEYGEN_TEMP_PATH || "./.temp";
const JBC_KEYGEN_TEMP_PATH = path.isAbsolute(baseTempPath) ? baseTempPath : path.resolve(__dirname, baseTempPath);

const execPath = process.env.JBC_KEYGEN_EXEC_PATH || "./jbc-deposit-cli";
const JBC_KEYGEN_EXEC_PATH = path.isAbsolute(execPath) ? execPath : path.resolve(__dirname, execPath);

function logBasic(...args) {
  if(process.env.NODE_ENV !== "production") {
    console.log(...args);
  }
}

function logTitle(title = "", ...args) {
  if(process.env.NODE_ENV !== "production") {
    title ? console.log(colors.magenta(title), ...args) : console.log(...args);
  }
}
function logProcess(name = "") {
  if(process.env.NODE_ENV !== "production" && name) {
    console.log(colors.blue(name))
  }
}

export function generateJbcKeysStream(qty = 1, withdrawAddress = "", keyPassword = "") {
  const sessionId = sessionGen();
  const keyPath = path.join(JBC_KEYGEN_TEMP_PATH, sessionId);
  const archive = archiver('zip', {
    zlib: { level: 9 } // Sets the compression level.
  });

  logTitle("Key Path", keyPath);
  logTitle("Exec Path", execPath);

  const delFolders = async () => {
    try {
      await fs.rm(keyPath, { recursive: true, force: true });
    } catch(err) {

    }
  }

  const generateKeys = async () => {
    const vcPath = path.join(keyPath, "validator_keys");

    await fs.mkdir(vcPath, { recursive: true });
    
    logProcess("Generate Keys");

    let finished = false;
    const filesRead = [];
    let watchFile = setInterval(async () => {
      if(finished) {
        archive.finalize();
        clearInterval(watchFile);
        return;
      }
      
      const fileLists = await fs.readdir(vcPath);
      for(const file of fileLists) {
        if(filesRead.indexOf(file) === -1) {
          logTitle("File Catch", file);
          filesRead.push(file);
          archive.file(path.join(vcPath, file), { name: file });
        }
      }
    }, 100);

    const genKeyProcess = spawn("./deposit.sh", [
      "--non_interactive",
      "new-mnemonic",
      `--num_validators=${qty}`,
      "--mnemonic_language=english",
      "--chain=jib",
      `--eth1_withdrawal_address=${withdrawAddress}`,
      `--keystore_password=${keyPassword}`,
      `--folder=${keyPath}`,
    ], {
      cwd: JBC_KEYGEN_EXEC_PATH,
      timeout: 60 * 60 * 1000,
    });

    logTitle("Logs");
    let out = "";
    let step = 1;

    genKeyProcess.stdout.on("data", (data) => {
      out += data.toString();
      logBasic(data.toString());

      if (step === 1 && out.includes("Please choose your language ['1. العربية', '2. ελληνικά', '3. English', '4. Français', '5. Bahasa melayu', '6. Italiano', '7. 日本語', '8. 한국어', '9. Português do Brasil', '10. român', '11. Türkçe', '12. 简体中文']:  [English]:")) {
        genKeyProcess.stdin.write("\n");
        step += 1;
      }

      if (step === 2 && out.includes("Please type your mnemonic (separated by spaces) to confirm you have written it down. Note: you only need to enter the first 4 letters of each word if you'd prefer.")) {
        const token = out.split("This is your mnemonic (seed phrase). Write it down and store it safely. It is the ONLY way to retrieve your deposit.")[1]
        const token1 = token.split("Please type your mnemonic (separated by spaces) to confirm you have written it down. Note: you only need to enter the first 4 letters of each word if you'd prefer.")[0]
        const mnemonic = token1.trim();

        logTitle("Key Mnemonic", mnemonic);
        archive.append(mnemonic, { name: "mnemonic.txt"})

        genKeyProcess.stdin.write(`${mnemonic}\n`);
        step += 1;
      }
    })

    genKeyProcess.on("error", (err) => {
      clearInterval(watchFile);
      throw err;
    });

    genKeyProcess.on("exit", async (code, signal) => {
      if (code === 0) {
        finished = true;
        logProcess("End");
      } else {
        const tokens = out.split('\n').filter((str) => !!str);
        const err = new Error(tokens[tokens.length - 1] || `Exit code:${code}`);
        clearInterval(watchFile);
        throw err;
      }
    })
  }

 
  // good practice to catch warnings (ie stat failures and other non-blocking errors)
  archive.on('warning', function(err) {
    if (err.code === 'ENOENT') {
      // log warning
    } else {
      // throw error
      delFolders();
      throw err;
    }
  });

  archive.on('error', function(err) {
    delFolders();
    throw err;
  });

  archive.on('finish', function(err) {
    delFolders();
  });

  generateKeys().catch((err) => {
    delFolders();
    throw err;
  });

  return archive;
}