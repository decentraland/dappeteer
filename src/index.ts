import * as path from 'path'
import * as puppeteer from 'puppeteer'

const timeout = seconds => new Promise(resolve => setTimeout(resolve, seconds * 1000))

export type LaunchOptions = puppeteer.LaunchOptions & {
  metamaskVersion?: string
  metamaskPath?: string
}

export type MetamaskOptions = {
  seed?: string
  password?: string
  extensionId?: string
  extensionUrl?: string
}

export type Dappeteer = {
  lock: () => Promise<void>
  unlock: (password: string) => Promise<void>
  addNetwork: (url: string) => Promise<void>
  importPK: (pk: string) => Promise<void>
  switchAccount: (accountNumber: number) => Promise<void>
  switchNetwork: (network: string) => Promise<void>
  confirmTransaction: (options: TransactionOptions) => Promise<void>
  sign: () => Promise<void>
  approve: () => Promise<void>
}

export type TransactionOptions = {
  gas: number
  gasLimit: number
}

export async function launch(puppeteer, options: LaunchOptions = {}): Promise<puppeteer.Browser> {
  const { args, ...rest } = options

  const { metamaskVersion, metamaskPath } = options
  const METAMASK_VERSION = metamaskVersion || '9.0.4'
  console['log'](path.join(__dirname, `metamask/${METAMASK_VERSION}`))
  const METAMASK_PATH = metamaskPath || path.resolve(__dirname, '..', 'metamask', METAMASK_VERSION)

  return puppeteer.launch({
    headless: false,
    args: [
      `--disable-extensions-except=${METAMASK_PATH}`,
      `--load-extension=${METAMASK_PATH}`,
      ...(args || [])
    ],
    ...rest
  })
}

export async function getMetamask(
  browser: puppeteer.Browser,
  options: MetamaskOptions = {}
): Promise<Dappeteer> {
  const metamaskPage = await closeHomeScreen(browser)
  // const metamaskPage = await getMetamaskPage(browser, options.extensionId, options.extensionUrl)
  await confirmWelcomeScreen(metamaskPage)

  await importAccount(
    metamaskPage,
    options.seed || 'already turtle birth enroll since owner keep patch skirt drift any dinner',
    options.password || 'password1234'
  )

  let signedIn = true

  closeNotificationPage(browser)

  return {
    lock: async () => {
      if (!signedIn) {
        throw new Error("You can't sign out because you haven't signed in yet")
      }
      await metamaskPage.bringToFront()
      const accountSwitcher = await metamaskPage.waitForSelector('.identicon')
      await accountSwitcher.click()
      const signoutButton = await metamaskPage.waitForSelector('.account-menu__lock-button')
      await signoutButton.click()
      await waitForSignInScreen(metamaskPage)
      signedIn = false
    },

    unlock: async (password = 'password1234') => {
      if (signedIn) {
        throw new Error("You can't sign in because you are already signed in")
      }
      await metamaskPage.bringToFront()
      const passwordBox = await metamaskPage.waitForSelector('#password')
      await passwordBox.type(password)
      const login = await metamaskPage.waitForSelector('.unlock-page button')
      await login.click()
      await waitForUnlockedScreen(metamaskPage)
      signedIn = true
    },

    addNetwork: async url => {
      await metamaskPage.bringToFront()
      const networkSwitcher = await metamaskPage.waitForSelector('.network-indicator')
      await networkSwitcher.click()
      await metamaskPage.waitForSelector('li.dropdown-menu-item')
      const networkIndex = await metamaskPage.evaluate(network => {
        const elements = document.querySelectorAll('li.dropdown-menu-item')
        for (let i = 0; i < elements.length; i++) {
          const element = elements[i]
          if ((element as HTMLLIElement).innerText.toLowerCase().includes(network.toLowerCase())) {
            return i
          }
        }
        return elements.length - 1
      }, 'Custom RPC')
      const networkButton = (await metamaskPage.$$('li.dropdown-menu-item'))[networkIndex]
      await networkButton.click()
      const newRPCInput = await metamaskPage.waitForSelector('input#new-rpc')
      await newRPCInput.type(url)
      const saveButton = await metamaskPage.waitForSelector('button.settings-tab__rpc-save-button')
      await saveButton.click()
      const prevButton = await metamaskPage.waitForSelector('img.app-header__metafox-logo')
      await prevButton.click()
      await waitForUnlockedScreen(metamaskPage)
    },

    importPK: async pk => {
      await metamaskPage.bringToFront()
      const accountSwitcher = await metamaskPage.waitForSelector('.identicon')
      await accountSwitcher.click()
      const addAccount = await metamaskPage.waitForSelector('.account-menu > div:nth-child(7)')
      await addAccount.click()
      const PKInput = await metamaskPage.waitForSelector('input#private-key-box')
      await PKInput.type(pk)
      const importButton = await metamaskPage.waitForSelector('button.btn-secondary')
      await importButton.click()
      await waitForUnlockedScreen(metamaskPage)
    },

    switchAccount: async accountNumber => {
      await metamaskPage.bringToFront()
      const accountSwitcher = await metamaskPage.waitForSelector('.identicon')
      await accountSwitcher.click()
      const account = await metamaskPage.waitForSelector(
        `.account-menu__accounts > div:nth-child(${accountNumber})`
      )
      await account.click()
      await waitForUnlockedScreen(metamaskPage)
    },

    switchNetwork: async (network = 'main') => {
      await metamaskPage.bringToFront()
      const networkSwitcher = await metamaskPage.waitForSelector('.network-indicator')
      await networkSwitcher.click()
      await metamaskPage.waitForSelector('li.dropdown-menu-item')
      const networkIndex = await metamaskPage.evaluate(network => {
        const elements = document.querySelectorAll('li.dropdown-menu-item')
        for (let i = 0; i < elements.length; i++) {
          const element = elements[i]
          if ((element as HTMLLIElement).innerText.toLowerCase().includes(network.toLowerCase())) {
            return i
          }
        }
        return 0
      }, network)
      const networkButton = (await metamaskPage.$$('li.dropdown-menu-item'))[networkIndex]
      await networkButton.click()
      await waitForEthereum(metamaskPage)
    },

    confirmTransaction: async options => {
      await metamaskPage.bringToFront()
      if (!signedIn) {
        throw new Error("You haven't signed in yet")
      }

      await metamaskPage.reload()

      if (options?.gas) {
        const gasSelector = '.advanced-gas-inputs__gas-edit-row:nth-child(1) input'
        const gas = await metamaskPage.waitForSelector(gasSelector)

        await metamaskPage.evaluate(
          () =>
            ((document.querySelectorAll(
              '.advanced-gas-inputs__gas-edit-row:nth-child(1) input'
            )[0] as HTMLInputElement).value = '')
        )
        await gas.type(options.gas.toString())
      }

      if (options?.gasLimit) {
        const gasLimitSelector = '.advanced-gas-inputs__gas-edit-row:nth-child(2) input'
        const gasLimit = await metamaskPage.waitForSelector(gasLimitSelector)

        await metamaskPage.evaluate(
          () =>
            ((document.querySelectorAll(
              '.advanced-gas-inputs__gas-edit-row:nth-child(2) input'
            )[0] as HTMLInputElement).value = '')
        )
        await gasLimit.type(options.gasLimit.toString())
      }

      const confirmButtonSelector =
        '#app-content > div > div.main-container-wrapper > div > div > div.page-container__footer > footer > button.button.btn-primary.page-container__footer-button'
      const confirmButton = await metamaskPage.waitForSelector(confirmButtonSelector)
      await confirmButton.click()
      await waitForUnlockedScreen(metamaskPage)
    },

    sign: async () => {
      await metamaskPage.bringToFront()
      if (!signedIn) {
        throw new Error("You haven't signed in yet")
      }
      await metamaskPage.reload()

      const confirmButtonSelector = '.request-signature__footer button.btn-secondary'

      const button = await metamaskPage.waitForSelector(confirmButtonSelector)
      await button.click()

      await waitForUnlockedScreen(metamaskPage)
    },

    approve: async () => {
      await metamaskPage.bringToFront()

      const confirmButtonSelector =
        '.permissions-connect-choose-account__bottom-buttons button.button.btn-primary'

        const button = await metamaskPage.waitForSelector(confirmButtonSelector)
        await button.click()
        
        const permissionApprovalSelector = 
          '.permission-approval-container__footers button.button.btn-primary'

          const permissionApprovalButton = await metamaskPage.waitForSelector(permissionApprovalSelector)
          await permissionApprovalButton.click()

      await waitForUnlockedScreen(metamaskPage)
    }
  }
}

async function closeHomeScreen(browser: puppeteer.Browser): Promise<puppeteer.Page> {
  return new Promise((resolve, reject) => {
    browser.on('targetcreated', async target => {
      if (target.url().match("chrome-extension://[a-z]+/home.html")) {
        try {
          const page = await target.page()
          resolve(page)
        } catch (e) {
          reject(e)
        }
      }
    })
  })
}

async function closeNotificationPage(browser: puppeteer.Browser) {
  browser.on('targetcreated', async target => {
    if (target.url() === 'chrome-extension://plkiloelkgnphnmaonlbbjbiphdalblo/notification.html') {
      try {
        const page = await target.page()
        await page.close()
      } catch {}
    }
  })
}

async function getMetamaskPage(browser, extensionId, extensionUrl) {
  const EXTENSION_ID = extensionId || 'nkbihfbeogaeaoehlefnkodbefgpgknn'
  const EXTENSION_URL = extensionUrl || `chrome-extension://${EXTENSION_ID}/popup.html`

  const metamaskPage = await browser.newPage()
  await metamaskPage.goto(EXTENSION_URL)
}

async function confirmWelcomeScreen(metamaskPage: puppeteer.Page) {
  const continueButton = await metamaskPage.waitForSelector('.welcome-page button')
  await continueButton.click()
}

async function importAccount(metamaskPage: puppeteer.Page, seed: string, password: string) {
  const importLink = await metamaskPage.waitForSelector('.first-time-flow button')
  await importLink.click()

  const metricsOptOut = await metamaskPage.waitForSelector('.metametrics-opt-in button.btn-primary')
  await metricsOptOut.click()

  const seedPhraseInput = await metamaskPage.waitForSelector('.first-time-flow__seedphrase input')
  await seedPhraseInput.type(seed)

  const passwordInput = await metamaskPage.waitForSelector('#password')
  await passwordInput.type(password)

  const passwordConfirmInput = await metamaskPage.waitForSelector('#confirm-password')
  await passwordConfirmInput.type(password)

  const acceptTerms = await metamaskPage.waitForSelector('.first-time-flow__terms')
  await acceptTerms.click()

  const restoreButton = await metamaskPage.waitForSelector('.first-time-flow__button')
  await restoreButton.click()

  const doneButton = await metamaskPage.waitForSelector('.end-of-flow button')
  await doneButton.click()

  const closeSwappingButton = await metamaskPage.waitForSelector('.popover-header__button')
  await closeSwappingButton.click()

  // Ensure popover is closed before continue
  await metamaskPage.waitForFunction(() => {
    return document.querySelector('.popover-header__button') == null
  })
}

async function waitForUnlockedScreen(metamaskPage) {
  await metamaskPage.waitForSelector('.main-container-wrapper')
}

async function waitForSignInScreen(metamaskPage) {
  await metamaskPage.waitForSelector('.unlock-page')
}

async function waitForEthereum(metamaskPage) {
  await Promise.race([waitUntilStartConnectingToEthereum(metamaskPage), timeout(1)])
  return Promise.race([waitUntilConnectedToEthereum(metamaskPage), timeout(10)])
}

async function waitUntilStartConnectingToEthereum(metamaskPage) {
  await metamaskPage.waitForFunction(() => {
    return !!document.querySelector('img[src="images/loading.svg"]')
  })
}

async function waitUntilConnectedToEthereum(metamaskPage) {
  await metamaskPage.waitForFunction(() => {
    return document.querySelector('img[src="images/loading.svg"]') == null
  })
}
