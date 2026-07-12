// Configuration Metro pour un monorepo npm workspaces.
// Permet à l'app Expo de résoudre et transpiler le package `contxt-domain`
// (TypeScript) situé hors de app/, à la racine du monorepo.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// 1. Surveiller toute la racine du monorepo (pour voir packages/*).
config.watchFolders = [workspaceRoot];

// 2. Résoudre les modules depuis l'app puis la racine.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

module.exports = config;
