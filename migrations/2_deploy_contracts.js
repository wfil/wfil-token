var WFIL = artifacts.require("WFIL");
const mainnet = require('./mainnet');

module.exports = function(deployer) {

	deployer.deploy(WFIL, mainnet.wfil.dao);
};
