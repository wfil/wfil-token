// based on https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/test/presets/ERC20PresetMinterPauser.test.js

// test/WFIL.test.js

const { accounts, contract, web3 } = require('@openzeppelin/test-environment');

const { BN, constants, expectEvent, expectRevert, send, ether } = require('@openzeppelin/test-helpers');
const { ZERO_ADDRESS } = constants;

const { expect } = require('chai');

const WFIL = contract.fromArtifact('WFIL');

let wfil;

describe('WFIL', function () {
const [ deployer, dao, factory, merchant, minter2, burner, other ] = accounts;

const name = 'Wrapped Filecoin';
const symbol = 'WFIL';

const amount = ether('10');

const DEFAULT_ADMIN_ROLE = '0x0000000000000000000000000000000000000000000000000000000000000000';
const MINTER_ROLE = web3.utils.soliditySha3('MINTER_ROLE');
const PAUSER_ROLE = web3.utils.soliditySha3('PAUSER_ROLE');

const ZERO = 0;

  beforeEach(async function () {
    wfil = await WFIL.new(dao, { from: deployer });
  });

  describe('Setup', async function () {
    it('dao has the default admin role', async function () {
      expect(await wfil.getRoleMemberCount(DEFAULT_ADMIN_ROLE)).to.be.bignumber.equal('1');
      expect(await wfil.getRoleMember(DEFAULT_ADMIN_ROLE, 0)).to.equal(dao);
    });

    it('dao has the pauser role', async function () {
      expect(await wfil.getRoleMemberCount(PAUSER_ROLE)).to.be.bignumber.equal('1');
      expect(await wfil.getRoleMember(PAUSER_ROLE, 0)).to.equal(dao);
    });

    it('pauser is the default admin', async function () {
      expect(await wfil.getRoleAdmin(PAUSER_ROLE)).to.equal(DEFAULT_ADMIN_ROLE);
    });
  });

  // Check Fallback function
  describe('fallback()', async function () {
    it('should revert when sending ether to contract address', async function () {
        await expectRevert.unspecified(send.ether(dao, wfil.address, 1));
    });
  });

  describe('WFIL metadata', function () {
    it('has a name', async () => {
        expect(await wfil.name({from:other})).to.equal(name);
    })
    it('has a symbol', async () => {
        expect(await wfil.symbol({from:other})).to.equal(symbol);
    })
  });

  describe('wrap()', function () {
    beforeEach(async () => {
      await wfil.addMinter(factory, {from:dao});
    });

    it('factory can mint tokens', async function () {
      const receipt = await wfil.wrap(merchant, amount, { from: factory });
      expect(await wfil.balanceOf(merchant)).to.be.bignumber.equal(amount);
    });

    it('should emit the appropriate event when wfil is wrapped', async () => {
      const receipt = await wfil.wrap(merchant, amount, {from: factory});
      expectEvent(receipt, 'Wrapped', { to: merchant, amount: amount });
      expectEvent(receipt, 'Transfer', { from: ZERO_ADDRESS, to: merchant, value: amount });
    });

    it('should revert when amount is less than zero', async function () {
      await expectRevert(wfil.wrap(merchant, ZERO, { from: factory }),'WFIL: amount is zero');
    });

    it('other accounts cannot wrap tokens', async function () {
      await expectRevert(wfil.wrap(merchant, amount, { from: other }),'WFIL: caller is not a minter');
    });
  });

  describe('unwrap()', async () => {
      beforeEach(async () => {
        await wfil.addMinter(factory, {from:dao});
        await wfil.wrap(merchant, amount, {from: factory});
      });

      it('wfil merchant should be able to burn wfil', async () => {
        await wfil.unwrap(amount, {from: merchant});
        expect(await wfil.balanceOf(merchant)).to.be.bignumber.equal('0');
      });

      it('should emit the appropriate event when wfil is unwrapped', async () => {
        const receipt = await wfil.unwrap(amount, {from: merchant});
        expectEvent(receipt, 'Unwrapped', { account: merchant, amount: amount });
        expectEvent(receipt, 'Transfer', { from: merchant, to: ZERO_ADDRESS, value: amount });
      });

      it('should revert when amount is less than zero', async function () {
        await expectRevert(wfil.unwrap(ZERO, { from: merchant }),'WFIL: amount is zero');
      });

      it('other accounts cannot unwrap tokens', async function () {
        await expectRevert(wfil.unwrap(amount, { from: other }), 'ERC20: burn amount exceeds balance');
      });
  })

  describe('unwrapFrom()', async () => {
      beforeEach(async () => {
        await wfil.addMinter(factory, {from:dao});
        await wfil.wrap(merchant, amount, {from: factory});
        await wfil.increaseAllowance(burner, amount, {from: merchant});
      });

      it('wfil burner should be able to burn wfil', async function () {
        await wfil.unwrapFrom(merchant, amount, {from:burner});
        expect(await wfil.balanceOf(merchant)).to.be.bignumber.equal('0');
      });

      it('should emit the appropriate event when wfil is unwrappedFrom', async () => {
        const receipt = await wfil.unwrapFrom(merchant, amount, {from:burner});
        expectEvent(receipt, 'UnwrappedFrom', { account: merchant, amount: amount });
        expectEvent(receipt, 'Transfer', { from: merchant, to: ZERO_ADDRESS, value: amount });
      });

      it('should revert when amount is less than zero', async function () {
        await expectRevert(wfil.unwrapFrom(merchant, ZERO, { from: burner }),'WFIL: amount is zero');
      });

      it('other accounts cannot unwrapFrom tokens', async function () {
        await expectRevert(wfil.unwrapFrom(other, amount, { from: burner }), 'WFIL: burn amount exceeds allowance');
      });
  });

  describe("addMinter()", async () => {
      it("default admin should be able to add a new minter", async () => {
        await wfil.addMinter(minter2, {from:dao});
        expect(await wfil.getRoleMember(MINTER_ROLE, 0)).to.equal(minter2);
      })

      it("should emit the appropriate event when a new minter is added", async () => {
        const receipt = await wfil.addMinter(minter2, {from:dao});
        expectEvent(receipt, "RoleGranted", { account: minter2 });
      })

      it("should revert when account is set to zero address", async () => {
        await expectRevert(wfil.addMinter(ZERO_ADDRESS, {from:dao}), 'WFIL: account is the zero address');
      })

      it("other address should not be able to add a new minter", async () => {
        await expectRevert(wfil.addMinter(minter2, {from:other}), 'WFIL: caller is not the default admin');
      })
  })

  describe("removeMinter()", async () => {
      beforeEach(async () => {
        await wfil.addMinter(minter2, {from: dao});
      })

      it("default admin should be able to remove a minter", async () => {
        await wfil.removeMinter(minter2, {from:dao});
        expect(await wfil.hasRole(MINTER_ROLE, minter2)).to.equal(false);
      })

      it("should emit the appropriate event when a minter is removed", async () => {
        const receipt = await wfil.removeMinter(minter2, {from:dao});
        expectEvent(receipt, "RoleRevoked", { account: minter2 });
      })

      it("other address should not be able to remove a minter", async () => {
        await expectRevert(wfil.removeMinter(minter2, {from: other}), 'WFIL: caller is not the default admin');
      })
  })

  describe('pausing', function () {
      it('owner can pause', async function () {
        const receipt = await wfil.pause({ from: dao });
        expectEvent(receipt, 'Paused', { account: dao });

        expect(await wfil.paused()).to.equal(true);
      });

      it('owner can unpause', async function () {
        await wfil.pause({ from: dao });

        const receipt = await wfil.unpause({ from: dao });
        expectEvent(receipt, 'Unpaused', { account: dao });

        expect(await wfil.paused()).to.equal(false);
      });

      it('cannot wrap while paused', async function () {
        await wfil.addMinter(factory, {from:dao});
        await wfil.pause({ from: dao });

        await expectRevert(
          wfil.wrap(other, amount, { from: factory }),
          'WFIL: token transfer while paused'
        );
      });

      it('cannot transfer while paused', async function () {
        await wfil.addMinter(factory, {from:dao});
        await wfil.wrap(merchant, amount, {from: factory});
        await wfil.pause({ from: dao });

        await expectRevert(
          wfil.transfer(other, amount, { from: merchant }),
          'WFIL: token transfer while paused'
        );
      });

      it('cannot unwrap while paused', async function () {
        await wfil.addMinter(factory, {from:dao});
        await wfil.wrap(merchant, amount, {from: factory});
        await wfil.pause({ from: dao });

        await expectRevert(
          wfil.unwrap(amount, { from: merchant }),
          'WFIL: token transfer while paused'
        );
      });

      it('other accounts cannot pause', async function () {
        await expectRevert(wfil.pause({ from: other }), 'WFIL: must have pauser role to pause');
      });
  });

  // Check override _tranfer() function
  describe('ERC20 _beforeTokenTransfer hook', async function () {
      beforeEach(async function () {
        await wfil.addMinter(factory, {from:dao});
        await wfil.wrap(merchant, amount, {from: factory});
      });

      it('check wrap() for revert when trying to mint to the token contract', async function () {
        await expectRevert(wfil.wrap(wfil.address, amount, {from:factory}), 'WFIL: transfer to the token contract');
      });

      it('check transfer() for revert when trying to transfer to the token contract', async function () {
        await expectRevert(wfil.transfer(wfil.address, amount, {from:merchant}), 'WFIL: transfer to the token contract');
      });

      it('check transferFrom() for revert when trying to transfer to the token contract', async function () {
        await wfil.increaseAllowance(wfil.address, amount, {from: merchant});
        await expectRevert(wfil.transferFrom(merchant, wfil.address, amount, {from:merchant}), 'WFIL: transfer to the token contract');
      });
  });
});
