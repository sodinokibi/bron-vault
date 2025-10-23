/**
 * Test Enhanced Wallet Extraction
 *
 * Run with: npx tsx scripts/test-enhanced-extraction.ts
 */

import { extractMetaMaskData, extractPhantomData } from '../lib/stealer-parsers/leveldb-wallet-extractor'
import { generateVaultCrackingReport, analyzeVaultCrackability } from '../lib/stealer-parsers/enhanced-wallet-integration'
import { existsSync } from 'fs'
import path from 'path'

async function testExtraction() {
  console.log('🧪 Testing Enhanced Wallet Extraction\n')

  // Example paths (adjust to your extracted logs)
  const testPaths = {
    metamask: 'uploads/extracted_files/2025-01-23/batch_xxx/device_yyy/Chrome/Default/Local Extension Settings/nkbihfbeogaeaoehlefnkodbefgpgknn',
    phantom: 'uploads/extracted_files/2025-01-23/batch_xxx/device_yyy/Chrome/Default/Local Extension Settings/bfnaelmomeimhlpmgjnjophhpkkoljpa'
  }

  // Test MetaMask
  console.log('📊 Testing MetaMask Extraction\n')
  console.log('=' .repeat(80))

  if (existsSync(testPaths.metamask)) {
    try {
      const metamaskData = await extractMetaMaskData(testPaths.metamask)

      console.log(`\n✅ MetaMask Results:`)
      console.log(`   Addresses found: ${metamaskData.totalAddresses}`)
      console.log(`   Account names: ${metamaskData.accountNames.length}`)
      console.log(`   Vault hash: ${metamaskData.vaultHash ? 'YES ✅' : 'NO ❌'}`)

      if (metamaskData.addresses.length > 0) {
        console.log(`\n   Sample Addresses:`)
        metamaskData.addresses.slice(0, 5).forEach((addr, i) => {
          console.log(`   ${i + 1}. ${addr.address} (${addr.chain}, ${addr.type})`)
        })
      }

      if (metamaskData.vaultHash) {
        console.log(`\n   🔐 Vault Hash Details:`)
        console.log(`      Mode: ${metamaskData.vaultHash.hashcatMode}`)
        console.log(`      Iterations: ${metamaskData.vaultHash.iterations}`)
        console.log(`      KDF: ${metamaskData.vaultHash.kdf}`)
        console.log(`      Hash: ${metamaskData.vaultHash.hash.substring(0, 80)}...`)

        // Analyze crack-ability
        const analysis = analyzeVaultCrackability({
          iterations: metamaskData.vaultHash.iterations,
          kdf: metamaskData.vaultHash.kdf
        })

        console.log(`\n   🎯 Crack-ability Analysis:`)
        console.log(`      Difficulty: ${analysis.difficulty}`)
        console.log(`      Weak password (8 char): ${analysis.estimatedTime.weak}`)
        console.log(`      Medium password (12 char): ${analysis.estimatedTime.medium}`)
        console.log(`      Strong password (16+ char): ${analysis.estimatedTime.strong}`)
        console.log(`      Recommendation: ${analysis.recommendation}`)
      }

    } catch (err) {
      console.error(`   ❌ Error: ${err}`)
    }
  } else {
    console.log(`   ⚠️  MetaMask directory not found: ${testPaths.metamask}`)
    console.log(`   💡 Adjust testPaths.metamask to point to actual extracted logs`)
  }

  // Test Phantom
  console.log('\n\n📊 Testing Phantom Extraction\n')
  console.log('=' .repeat(80))

  if (existsSync(testPaths.phantom)) {
    try {
      const phantomData = await extractPhantomData(testPaths.phantom)

      console.log(`\n✅ Phantom Results:`)
      console.log(`   Total addresses: ${phantomData.totalAddresses}`)
      console.log(`   Vault hash: ${phantomData.vaultHash ? 'YES ✅' : 'NO ❌'}`)

      // Group by chain
      const byChain = {
        SOL: phantomData.addresses.filter(a => a.chain === 'SOL'),
        ETH: phantomData.addresses.filter(a => a.chain === 'ETH'),
        BTC: phantomData.addresses.filter(a => a.chain === 'BTC'),
        SUI: phantomData.addresses.filter(a => a.chain === 'SUI')
      }

      console.log(`\n   By Chain:`)
      if (byChain.SOL.length > 0) {
        console.log(`   🟣 Solana: ${byChain.SOL.length}`)
        byChain.SOL.slice(0, 3).forEach(addr => {
          console.log(`      - ${addr.address}`)
        })
      }

      if (byChain.ETH.length > 0) {
        console.log(`   🔷 Ethereum: ${byChain.ETH.length}`)
        byChain.ETH.slice(0, 3).forEach(addr => {
          console.log(`      - ${addr.address}`)
        })
      }

      if (byChain.BTC.length > 0) {
        console.log(`   🟠 Bitcoin: ${byChain.BTC.length}`)
        byChain.BTC.slice(0, 3).forEach(addr => {
          console.log(`      - ${addr.address}`)
        })
      }

      if (byChain.SUI.length > 0) {
        console.log(`   🔵 Sui: ${byChain.SUI.length}`)
        byChain.SUI.slice(0, 3).forEach(addr => {
          console.log(`      - ${addr.address}`)
        })
      }

      if (phantomData.vaultHash) {
        console.log(`\n   🔐 Vault Hash:`)
        console.log(`      Mode: ${phantomData.vaultHash.hashcatMode}`)
        console.log(`      Hash: ${phantomData.vaultHash.hash.substring(0, 80)}...`)
      }

    } catch (err) {
      console.error(`   ❌ Error: ${err}`)
    }
  } else {
    console.log(`   ⚠️  Phantom directory not found: ${testPaths.phantom}`)
    console.log(`   💡 Adjust testPaths.phantom to point to actual extracted logs`)
  }

  console.log('\n' + '=' .repeat(80))
  console.log('✅ Testing complete!\n')
}

// Run test
testExtraction().catch(console.error)
