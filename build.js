const { mkdirSync, readdirSync, lstatSync, copyFileSync, rmSync, existsSync } = require("fs");
const { join, extname } = require("path");

// function that copies a folder and all subfolders to another folder
function copyDirRecursiveSync(from, to) {
  mkdirSync(to);
  readdirSync(from).forEach((element) => {
    if (lstatSync(join(from, element)).isFile()) {
      copyFileSync(join(from, element), join(to, element));
    } else {
      copyDirRecursiveSync(join(from, element), join(to, element));
    }
  });
}

// function that deletes all files with a specific extension in a folder and its subfolders
function removeFileByType(folder, type) {
  readdirSync(folder).forEach((element) => {
    if (lstatSync(join(folder, element)).isFile()) {
      if (extname(join(folder, element)) == type) {
        rmSync(join(folder, element));
      }
    } else {
      removeFileByType(join(folder, element), type);
    }
  });
}

const binPath = join(__dirname, "bin");
const srcPath = join(__dirname, "src");

// if the bin folder exists, delete it
if (existsSync(binPath)) {
  rmSync(binPath, { recursive: true });
}

// copy the src folder to the bin folder. (this is for all non .ts files)
copyDirRecursiveSync(srcPath, binPath);
// delete all the .ts files in the bin folder and its subfolders
removeFileByType(binPath, ".ts");
// delete all the .json files in the bin folder and its subfolders (for possible config files)
removeFileByType(binPath, ".json");
