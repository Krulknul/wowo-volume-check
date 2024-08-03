
import { GatewayApiClient, RadixNetwork } from "@radixdlt/babylon-gateway-api-sdk";
const csv = require('csv-parser')
const fs = require('fs')

const gatewayApi = GatewayApiClient.initialize({
  networkId: RadixNetwork.Mainnet,
  applicationName: '',
})

const csvLines: any[] = [];
let transactionsHandled = 0
// map stores the volume of each token by its ResourceAddress
const volume_map = new Map<string, number>()

fs.createReadStream('transactions.csv')
  .pipe(csv())
  .on('data', (data: any) => csvLines.push(data))
  .on('end', () => {
    csvLines.forEach(async (result) => {
      const tx = await gatewayApi.transaction.getCommittedDetails(result.intent_hash)
      tx.transaction.balance_changes?.fungible_balance_changes.forEach((change) => {
        // if the change is the removal of fungible resource from an account, it must be the input to the swap.
        // we can then add the volume to the volume_map
        // Since fungible_balance_changes is all non-fee-related changes and only one account should be affected,
        // we can safely assume that the change is the input to the swap
        if (change.entity_address.startsWith("account_") && Number(change.balance_change) < 0) {
          const volume = volume_map.get(change.resource_address) || 0
          volume_map.set(change.resource_address, volume + Math.abs(Number(change.balance_change)))
        }
      })
      transactionsHandled += 1
      console.log("Volume map:", volume_map)
      console.log('Transactions handled:', transactionsHandled + '/' + csvLines.length)
    });
  });

