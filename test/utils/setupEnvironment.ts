import "@nomiclabs/hardhat-web3"
import ganache  from 'ganache-core'
import { deployments, web3 } from 'hardhat'
import handler from 'serve-handler'

import * as fs from 'fs'
import * as http from 'http'
import * as path from 'path'

let counterContract = null

const setupAndDeploy = async () => {
  await waitForGanache()
  await deployContract()
  await startTestServer()

  return counterContract
}

const waitForGanache = async () => {
  console.log('Starting ganache...')
  const server = ganache.server({ seed: 'asd123' })
  await new Promise(res => {
    server.listen(8545, () => {
      console.log('Ganache running at http://localhost:8545')
      res(undefined)
    })
  })
}

const setupHardhat = deployments.createFixture(async ({ deployments }) => {
  await deployments.fixture()
  const Counter = await deployments.get('Counter')
  return Counter
})

const deployContract = async () => {
  console.log('Deploying test contract...')
  const{ abi, address} = await setupHardhat()
  counterContract = new web3.eth.Contract(abi, address)
  fs.writeFileSync(
    path.join(__dirname, '../server/data.js'),
    `var ContractInfo = ${JSON.stringify({
      abi: abi,
      address
    })}`
  )
  console.log('Contract deployed at', address)
}

const startTestServer = async () => {
  console.log('Starting test server...')
  const server = http.createServer((request, response) => {
    return handler(request, response, {
      public: path.join(__dirname, '../server'),
      cleanUrls: true
    })
  })

  await new Promise(res => {
    server.listen(8080, () => {
      console.log('Server running at http://localhost:8080')
      res(undefined)
    })
  })
}

export default setupAndDeploy
