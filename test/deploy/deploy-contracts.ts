import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'

const deploy: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts } = hre

  const { deployer } = await getNamedAccounts()
  const { deploy } = deployments

  await deploy('Counter', {
    from: deployer,
    args: [],
    log: true,
  })
}

export default deploy
