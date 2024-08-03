
import { GatewayApiClient, RadixNetwork } from "@radixdlt/babylon-gateway-api-sdk";

const gatewayApi = GatewayApiClient.initialize({
  networkId: RadixNetwork.Mainnet,
  applicationName: '',
})
type Task = () => Promise<any>;

interface QueueItem {
  task: Task;
  resolve: (value?: any) => void;
  reject: (reason?: any) => void;
}

export class PromiseQueue {
  private maxConcurrent: number;
  private currentRunning: number;
  private queue: QueueItem[];

  constructor(maxConcurrent: number = 5) {
    this.maxConcurrent = maxConcurrent;
    this.currentRunning = 0;
    this.queue = [];
  }

  // Add a task to the queue
  enqueue(task: Task): Promise<any> {
    return new Promise((resolve, reject) => {
      this.queue.push({
        task,
        resolve,
        reject
      });
      this.run();
    });
  }

  // Run the next task if possible
  private async run(): Promise<void> {
    if (this.queue.length > 0 && this.currentRunning < this.maxConcurrent) {
      // Increase the count of currently running tasks
      this.currentRunning++;
      const { task, resolve, reject } = this.queue.shift()!;
      try {
        const result = await task();
        resolve(result);
      } catch (error) {
        reject(error);
      } finally {
        this.currentRunning--;
        this.run(); // Try to run the next task
      }
    }
  }
}

const csv = require('csv-parser')
const fs = require('fs')

const results: any[] = [];
let transactions_handled = 0

const volume_map = new Map<string, number>()

fs.createReadStream('transactions.csv')
  .pipe(csv())
  .on('data', (data: any) => results.push(data))
  .on('end', () => {
    console.log('CSV file successfully processed');
    const queue = new PromiseQueue(2)
    results.forEach(async (result) => {
      const txId = result.intent_hash
      console.log(txId)
      // const tx = await gatewayApi.transaction.getCommittedDetails(txId)
      queue.enqueue(async () => {
        const tx = await gatewayApi.transaction.getCommittedDetails(txId)
        transactions_handled += 1
        console.log("Volume map:", volume_map)
        console.log('Transactions handled:', transactions_handled + '/' + results.length)
        tx.transaction.balance_changes?.fungible_balance_changes.forEach((change) => {
          if (change.entity_address.startsWith("account_") && Number(change.balance_change) < 0) {
            const volume = volume_map.get(change.resource_address) || 0
            volume_map.set(change.resource_address, volume + Math.abs(Number(change.balance_change)))
          }
        })
      })
    });
  });

