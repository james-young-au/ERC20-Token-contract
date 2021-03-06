import EthQuery from 'ethjs-query';
import { createTestProviderTools } from '../../test/stub/provider';
import { TRANSACTION_TYPES } from '../constants/transaction';
import {
  determineTransactionType,
  isEIP1559Transaction,
  isLegacyTransaction,
} from './transaction.utils';

describe('Transaction.utils', function () {
  describe('isEIP1559Transaction', function () {
    it('should return true if both maxFeePerGas and maxPriorityFeePerGas are hex strings', () => {
      expect(
        isEIP1559Transaction({
          txParams: { maxFeePerGas: '0x1', maxPriorityFeePerGas: '0x1' },
        }),
      ).toBe(true);
    });

    it('should return false if either maxFeePerGas and maxPriorityFeePerGas are non-hex strings', () => {
      expect(
        isEIP1559Transaction({
          txParams: { maxFeePerGas: 0, maxPriorityFeePerGas: '0x1' },
        }),
      ).toBe(false);
      expect(
        isEIP1559Transaction({
          txParams: { maxFeePerGas: '0x1', maxPriorityFeePerGas: 'fail' },
        }),
      ).toBe(false);
    });

    it('should return false if either maxFeePerGas or maxPriorityFeePerGas are not supplied', () => {
      expect(
        isEIP1559Transaction({
          txParams: { maxPriorityFeePerGas: '0x1' },
        }),
      ).toBe(false);
      expect(
        isEIP1559Transaction({
          txParams: { maxFeePerGas: '0x1' },
        }),
      ).toBe(false);
    });
  });

  describe('isLegacyTransaction', function () {
    it('should return true if no gas related fields are supplied', () => {
      expect(
        isLegacyTransaction({
          txParams: {},
        }),
      ).toBe(true);
    });

    it('should return true if gasPrice is solely provided', () => {
      expect(
        isLegacyTransaction({
          txParams: { gasPrice: '0x1' },
        }),
      ).toBe(true);
    });

    it('should return false if gasPrice is not a hex string', () => {
      expect(
        isLegacyTransaction({
          txParams: { gasPrice: 100 },
        }),
      ).toBe(false);
    });

    it('should return false if either maxFeePerGas or maxPriorityFeePerGas are supplied', () => {
      expect(
        isLegacyTransaction({
          txParams: {
            maxFeePerGas: '0x1',
          },
        }),
      ).toBe(false);

      expect(
        isLegacyTransaction({
          txParams: {
            maxPriorityFeePerGas: 'any data',
          },
        }),
      ).toBe(false);
    });
  });

  describe('determineTransactionType', function () {
    const genericProvider = createTestProviderTools().provider;
    const query = new EthQuery(genericProvider);

    it('should return a simple send type when to is truthy but data is falsy', async function () {
      const result = await determineTransactionType(
        {
          to: '0xabc',
          data: '',
        },
        query,
      );
      expect(result).toMatchObject({
        type: TRANSACTION_TYPES.SIMPLE_SEND,
        getCodeResponse: null,
      });
    });

    it('should return a token transfer type when data is for the respective method call', async function () {
      const result = await determineTransactionType(
        {
          to: '0xabc',
          data:
            '0xa9059cbb0000000000000000000000002f318C334780961FB129D2a6c30D0763d9a5C970000000000000000000000000000000000000000000000000000000000000000a',
        },
        query,
      );
      expect(result).toMatchObject({
        type: TRANSACTION_TYPES.TOKEN_METHOD_TRANSFER,
        getCodeResponse: undefined,
      });
    });

    it('should return a token approve type when data is for the respective method call', async function () {
      const result = await determineTransactionType(
        {
          to: '0xabc',
          data:
            '0x095ea7b30000000000000000000000002f318C334780961FB129D2a6c30D0763d9a5C9700000000000000000000000000000000000000000000000000000000000000005',
        },
        query,
      );
      expect(result).toMatchObject({
        type: TRANSACTION_TYPES.TOKEN_METHOD_APPROVE,
        getCodeResponse: undefined,
      });
    });

    it('should return a contract deployment type when to is falsy and there is data', async function () {
      const result = await determineTransactionType(
        {
          to: '',
          data: '0xabd',
        },
        query,
      );
      expect(result).toMatchObject({
        type: TRANSACTION_TYPES.DEPLOY_CONTRACT,
        getCodeResponse: undefined,
      });
    });

    it('should return a simple send type with a 0x getCodeResponse when there is data and but the to address is not a contract address', async function () {
      const result = await determineTransactionType(
        {
          to: '0x9e673399f795D01116e9A8B2dD2F156705131ee9',
          data: '0xabd',
        },
        query,
      );
      expect(result).toMatchObject({
        type: TRANSACTION_TYPES.SIMPLE_SEND,
        getCodeResponse: '0x',
      });
    });

    it('should return a simple send type with a null getCodeResponse when to is truthy and there is data and but getCode returns an error', async function () {
      const result = await determineTransactionType(
        {
          to: '0xabc',
          data: '0xabd',
        },
        query,
      );
      expect(result).toMatchObject({
        type: TRANSACTION_TYPES.SIMPLE_SEND,
        getCodeResponse: null,
      });
    });

    it('should return a contract interaction type with the correct getCodeResponse when to is truthy and there is data and it is not a token transaction', async function () {
      const _providerResultStub = {
        // 1 gwei
        eth_gasPrice: '0x0de0b6b3a7640000',
        // by default, all accounts are external accounts (not contracts)
        eth_getCode: '0xa',
      };
      const _provider = createTestProviderTools({
        scaffold: _providerResultStub,
      }).provider;

      const result = await determineTransactionType(
        {
          to: '0x9e673399f795D01116e9A8B2dD2F156705131ee9',
          data: 'abd',
        },
        new EthQuery(_provider),
      );
      expect(result).toMatchObject({
        type: TRANSACTION_TYPES.CONTRACT_INTERACTION,
        getCodeResponse: '0x0a',
      });
    });

    it('should return a contract interaction type with the correct getCodeResponse when to is a contract address and data is falsy', async function () {
      const _providerResultStub = {
        // 1 gwei
        eth_gasPrice: '0x0de0b6b3a7640000',
        // by default, all accounts are external accounts (not contracts)
        eth_getCode: '0xa',
      };
      const _provider = createTestProviderTools({
        scaffold: _providerResultStub,
      }).provider;

      const result = await determineTransactionType(
        {
          to: '0x9e673399f795D01116e9A8B2dD2F156705131ee9',
          data: '',
        },
        new EthQuery(_provider),
      );
      expect(result).toMatchObject({
        type: TRANSACTION_TYPES.CONTRACT_INTERACTION,
        getCodeResponse: '0x0a',
      });
    });
  });
});
