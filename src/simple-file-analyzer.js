import 'dotenv/config';

// Simple direct approach - use the exact URLs from your search results
const TARGET_URLS = [
  'https://github.com/reserve-protocol/protocol/blob/73362259c5a14c9c7bf3db0bd64fd9d1d370568a/contracts/plugins/assets/ERC4626FiatCollateral.sol',
  'https://github.com/curvance/Curvance-CantinaCompetition/blob/76669e36572d9c6803a0e706214a9149d5247586/contracts/market/collateral/CTokenPrimitive.sol',
  'https://github.com/sturdyfi/sturdy-contracts/blob/944dc537195413c4adc65a6f00cc80344b0f5ba4/contracts/protocol/vault/ERC4626/ERC4626Vault.sol',
  'https://github.com/timeless-fi/yield-daddy/blob/8b8761035f4874550679bf13f427c539594947f5/src/aave-v2/AaveV2ERC4626.sol'
];

console.log('🔍 SIMPLE DIRECT FILE ANALYZER');
console.log('='.repeat(50));
console.log('Analyzing files using exact GitHub URLs from your search...\n');

async function analyzeDirectUrls() {
  for (const url of TARGET_URLS) {
    console.log(`📄 Analyzing: ${url.split('/').slice(-1)[0]}`);
    console.log(`   🔗 ${url}`);
    
    try {
      // Convert GitHub URL to raw content URL
      const rawUrl = url
        .replace('github.com', 'raw.githubusercontent.com')
        .replace('/blob/', '/');
      
      const response = await fetch(rawUrl);
      const content = await response.text();
      
      // Simple pattern matching
      const patterns = {
        'CRITICAL': /totalAssets\s*\/\s*totalSupply/g,
        'HIGH': /\.pricePerShare\(\)|\.convertToAssets\(/g,
        'MEDIUM': /ERC4626|vault.*collateral/g
      };
      
      let vulnerabilities = [];
      for (const [severity, pattern] of Object.entries(patterns)) {
        const matches = content.match(pattern);
        if (matches) {
          vulnerabilities.push({ severity, pattern: pattern.toString(), count: matches.length });
        }
      }
      
      if (vulnerabilities.length > 0) {
        console.log(`   💀 VULNERABILITIES FOUND:`);
        vulnerabilities.forEach(vuln => {
          console.log(`      ${vuln.severity}: ${vuln.pattern} (${vuln.count} matches)`);
        });
      } else {
        console.log(`   ✅ No obvious vulnerable patterns found`);
      }
      
    } catch (error) {
      console.log(`   ❌ Cannot access: ${error.message}`);
    }
    
    console.log('');
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('💡 Manual review recommended for these integration points!');
}

analyzeDirectUrls().catch(console.error);
