import { Command, Option } from 'nest-commander';
import {
  getUtxos,
  OpenMinterTokenInfo,
  getTokenMinter,
  logerror,
  getTokenMinterCount,
  isOpenMinter,
  sleep,
  needRetry,
  unScaleByDecimals,
  getTokens,
  btc,
  TokenMetadata,
} from 'src/common';
import { openMint } from './ft.open-minter';
import { ConfigService, SpendService, WalletService } from 'src/providers';
import { Inject } from '@nestjs/common';
import { log } from 'console';
import { findTokenMetadataById, scaleConfig } from 'src/token';
import Decimal from 'decimal.js';
import {
  BoardcastCommand,
  BoardcastCommandOptions,
} from '../boardcast.command'
import { broadcastMergeTokenTxsmergeTokens } from '../send/merge'
import { calcTotalAmountsendToken } from '../send/ft'
import { pickLargeFeeUtxo } from '../send/pick'
{
  id
  new
}

function getRandomInt(max) {
  returnfloor(random())
}

@Command({
  name'mint'
'Mint a token'
})
export{
(
    @Inject() private readonly spendService
    @Inject()
    @Inject()
  ) {
    super()
  }

  async cat_cli_run(
[]
    options
  )void{
    try {
      (id) {
        const addressthiswalletServicegetAddress()
        const tokenawait findTokenMetadataById(
          thisconfigService
id
        )

        if () {
error(`No token found for tokenId: ${}`)
          return
        }

        const scaledInfoscaleConfig(as)

        let amount

        if ([0]) {
          try {
            const dnew([0])mul(
pow(10)
            )
BigInt(toString())
          } catch (error) {
            logerror(`Invalid amount: "${[0]}"`)
            return
          }
        }

        const MAX_RETRY_COUNT10

        for (let index0) {
          
          const feeRateawait thisgetFeeRate()
          const feeUtxosawait thisgetFeeUTXOs()
          if () {
warn('Insufficient satoshis balance!')
            return
          }

          const countawait getTokenMinterCount(
            thisconfigService
tokenId
          )

          const maxTry

          if (0) {
error('No available minter UTXO found!')
            return
          }

          const offsetgetRandomInt(1)
          const minterawait getTokenMinter(
            thisconfigService
            thiswalletService
            token,
            offset,
          )

          if (null) {
            continue
          }

          if (isOpenMinter(token.info.minterMd5)) {
            const minterState = minter.state.data;
            if (minterState.isPremined && amount > scaledInfo.limit) {
              console.error('The number of minted tokens exceeds the limit!');
              return;
            }

            const limit = scaledInfo.limit;

            if (!minter.state.data.isPremined && scaledInfo.premine > 0n) {
              if (typeof amount === 'bigint') {
                if (amount !== scaledInfo.premine) {
                  throw new Error(
                    `first mint amount should equal to premine ${scaledInfo.premine}`,
                  );
                }
              } else {
                amount = scaledInfo.premine;
              }
            } else {
              amount = amount || limit;
              amount =
                amount > minter.state.data.remainingSupply
                  ? minter.state.data.remainingSupply
                  : amount;
            }

            const mintTxIdOrErr = await openMint(
              this.configService,
              this.walletService,
              this.spendService,
              feeRate,
              feeUtxos,
              token,
              2,
              minter,
              amount,
            );

            if (mintTxIdOrErr instanceof Error) {
              if (needRetry(mintTxIdOrErr)) {
                // throw these error, so the caller can handle it.
                log(`retry to mint token [${token.info.symbol}] ...`);
                await sleep(6);
                continue;
              } else {
                logerror(
                  `mint token [${token.info.symbol}] failed`,
                  mintTxIdOrErr,
                );
                return;
              }
            }

            console.log(
              `Minting ${unScaleByDecimals(amount, token.info.decimals)} ${token.info.symbol} tokens in txid: ${mintTxIdOrErr} ...`,
            );
            return;
          } else {
            throw new Error('unkown minter!');
          }
        }

        console.error(`mint token [${token.info.symbol}] failed`);
      } else {
        throw new Error('expect a ID option');
      }
    } catch (error) {
      logerror('mint failed!', error);
    }
  }

  async merge(metadata: TokenMetadata, address: btc.Addres) {
    const res = await getTokens(
      this.configService,
      this.spendService,
      metadata,
      address,
    );

    if (res !== null) {
      const { contracts: tokenContracts } = res;

      if (tokenContracts.length > 1) {
        const cachedTxs: Map<string, btc.Transaction> = new Map();
        console.info(`Start merging your [${metadata.info.symbol}] tokens ...`);

        const feeUtxos = await this.getFeeUTXOs(address);
        const feeRate = await this.getFeeRate();
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const [newTokens, newFeeUtxos, e] = await mergeTokens(
          this.configService,
          this.walletService,
          this.spendService,
          feeUtxos,
          feeRate,
          metadata,
          tokenContracts,
          address,
          cachedTxs,
        );

        if (e instanceof Error) {
          logerror('merge token failed!', e);
          return;
        }

        const feeUtxo = pickLargeFeeUtxo(newFeeUtxos);

        if (newTokens.length > 1) {
          const amountTobeMerge = calcTotalAmount(newTokens);
          const result = await sendToken(
            this.configService,
            this.walletService,
            feeUtxo,
            feeRate,
            metadata,
            newTokens,
            address,
            address,
            amountTobeMerge,
            cachedTxs,
          );
          if (result) {
            await broadcastMergeTokenTxs(
              this.configService,
              this.walletService,
              this.spendService,
              [result.commitTx, result.revealTx],
            );

            console.info(
              `Merging your [${metadata.info.symbol}] tokens in txid: ${result.revealTx.id} ...`,
            );
          }
        }
      }
    }
  }

  @Option({
    flags: '-i, --id [tokenId]',
    description: 'ID of the token',
  })
  parseId(val: string): string {
    return val;
  }

  async getFeeUTXOs(address: btc.Address) {
    let feeUtxos = await getUtxos(
      this.configService,
      this.walletService,
      address,
    );

    feeUtxos = feeUtxos.filter((utxo) => {
      return this.spendService.isUnspent(utxo);
    });

    if (feeUtxos.length === 0) {
      console.warn('Insufficient satoshis balance!');
      return [];
    }
    return feeUtxos;
  }
}
