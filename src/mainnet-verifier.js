import 'dotenv/config';

console.log('🔍 MAINNET DEPLOYMENT VERIFIER');
console.log('='.repeat(50));
console.log('Checking which vulnerable targets are actually deployed on mainnet...\n');

// High-priority production targets from triage
const HIGH_PRIORITY_TARGETS = [
  'wildcat-finance/wildcat-protocol',
  'tetu-io/tetu-contracts-v2', 
  'berachain/contracts',
  'arcadia-finance/arcadia-lending',
  'pods-finance/yield-contracts',
  'centrifuge/liquidity-pools',
  'Fathom-Fi/fathom-vaults-smart-contracts'
];

console.log('�� HIGH-PRIORITY TARGETS TO VERIFY:');
HIGH_PRIORITY_TARGETS.forEach((target, index) => {
  console.log(`${index + 1}. ${target}`);
});

console.log('\n💡 MANUAL VERIFICATION REQUIRED:');
console.log('   1. Visit Etherscan and search for contract deployments');
console.log('   2. Check DefiLlama for TVL data');
console.log('   3. Verify recent transaction activity');
console.log('   4. Confirm the protocol is live and has users');
console.log('\n�� Only proceed with exploit development after mainnet verification!');
