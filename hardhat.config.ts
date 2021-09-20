import '@nomiclabs/hardhat-web3'
import 'hardhat-deploy'
import { HardhatUserConfig } from 'hardhat/types'

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
 const config: HardhatUserConfig = {
  defaultNetwork: 'localhost',
  solidity: '0.8.6',
  paths: {
    sources: 'test/contracts',
    deploy: 'test/deploy'
  },
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545"
    },
  },
  namedAccounts: {
    deployer: {
      default: 0
    }
  }
}

export default config
