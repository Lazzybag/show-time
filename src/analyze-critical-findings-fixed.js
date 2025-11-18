import 'dotenv/config';
import { Octokit } from '@octokit/rest';

const octokit = new Octokit({ 
  auth: process.env.GITHUB_TOKEN
});

// CRITICAL TARGETS WITH EXACT PATHS from your search results
const CRITICAL_TARGETS = [
  {
    repo: 'reserve-protocol/protocol',
    file: 'ERC4626FiatCollateral.sol',
    exactPath: 'contracts/plugins/assets/ERC4626FiatCollateral.sol',
    risk: 'VERY_HIGH',
    reason: 'Direct ERC4626 collateral implementation'
  },
  {
    repo: 'yieldprotocol/vault-v2', 
    file: 'YearnVaultMultiOracle.sol',
    exactPath: 'src/oracles/yearn/YearnVaultMultiOracle.sol',
    risk: 'HIGH',
    reason: 'Vault price oracle - potential direct pricePerShare usage'
  },
  {
    repo: 'curvance/Curvance-CantinaCompetition',
    file: 'CTokenPrimitive.sol', 
    exactPath: 'contracts/market/collateral/CTokenPrimitive.sol',
    risk: 'HIGH',
    reason: 'Collateral token with vault integration'
  },
  {
    repo: 'sturdyfi/sturdy-contracts',
    file: 'ERC4626Vault.sol',
    exactPath: 'contracts/protocol/vault/ERC4626/ERC4626Vault.sol',
    risk: 'HIGH',
    reason: 'Explicit ERC4626 vault implementation'
  },
  {
    repo: 'arcadia-finance/arcadia-lending',
    file: 'LendingPool.sol',
    exactPath: 'src/LendingPool.sol',
    risk: 'MEDIUM_HIGH',
    reason: 'Lending pool with potential vault collateral'
  },
  {
    repo: 'timeless-fi/yield-daddy',
    file: 'AaveV2ERC4626.sol',
    exactPath: 'src/aave-v2/AaveV2ERC4626.sol',
    risk: 'MEDIUM',
    reason: 'Aave v2 ERC4626 wrapper - check price calculations'
  }
];

class CriticalFindingsAnalyzerFixed {
  constructor() {
    this.analysisResults = [];
  }

  async analyzeCriticalTargets() {
    console.log('🔍 CRITICAL FINDINGS ANALYSIS - FIXED VERSION');
    console.log('='.repeat(70));
    console.log('Using EXACT file paths from your search results...\n');

    for (const target of CRITICAL_TARGETS) {
      console.log(`🎯 ANALYZING: ${target.repo}`);
      console.log(`   📄 File: ${target.file}`);
      console.log(`   📍 Path: ${target.exactPath}`);
      console.log(`   ⚠️  Risk: ${target.risk} - ${target.reason}`);
      
      const analysis = await this.analyzeTarget(target);
      this.analysisResults.push(analysis);
      
      console.log('   '.padEnd(50, '─'));
      await this.delay(1200); // More conservative rate limiting
    }

    this.generateCriticalReport();
  }

  async analyzeTarget(target) {
    const [owner, repo] = target.repo.split('/');
    const result = {
      ...target,
      accessible: false,
      vulnerablePatterns: [],
      mainnetPotential: false,
      recommendation: '',
      rawContent: ''
    };

    try {
      // Try the exact path first
      const { data: fileContent } = await octokit.rest.repos.getContent({
        owner,
        repo,
        path: target.exactPath
      });

      result.accessible = true;
      const content = Buffer.from(fileContent.content, 'base64').toString('utf8');
      result.rawContent = content;
      
      // Analyze for specific vulnerability patterns
      result.vulnerablePatterns = this.analyzeForVulnerabilities(content, target.file);
      
      // Check for mainnet indicators
      result.mainnetPotential = this.checkMainnetIndicators(content);
      
      // Generate recommendation
      result.recommendation = this.generateRecommendation(result);

      console.log(`   ✅ ACCESSIBLE - ${result.vulnerablePatterns.length} vulnerability patterns found`);
      if (result.vulnerablePatterns.length > 0) {
        result.vulnerablePatterns.forEach(pattern => {
          console.log(`      💀 ${pattern.type}: ${pattern.description}`);
          // Show a snippet of the vulnerable code
          if (pattern.context) {
            const lines = pattern.context.split('\n');
            console.log(`         📝 ${lines.slice(0, 3).join(' | ')}...`);
          }
        });
      } else {
        console.log(`   ✅ Clean - no obvious vulnerable patterns detected`);
      }

    } catch (error) {
      console.log(`   ❌ Cannot access: ${error.message}`);
      // Try alternative path search
      await this.tryAlternativePaths(owner, repo, target, result);
    }

    return result;
  }

  async tryAlternativePaths(owner, repo, target, result) {
    console.log(`   🔄 Trying to find file via search...`);
    
    try {
      // Search for the file in the repository
      const { data: searchResults } = await octokit.rest.search.code({
        q: `filename:${target.file} repo:${owner}/${repo}`,
        per_page: 5
      });

      if (searchResults.items.length > 0) {
        const foundPath = searchResults.items[0].path;
        console.log(`      Found at: ${foundPath}`);
        
        const { data: fileContent } = await octokit.rest.repos.getContent({
          owner,
          repo,
          path: foundPath
        });

        result.accessible = true;
        const content = Buffer.from(fileContent.content, 'base64').toString('utf8');
        result.rawContent = content;
        result.vulnerablePatterns = this.analyzeForVulnerabilities(content, target.file);
        result.mainnetPotential = this.checkMainnetIndicators(content);
        result.recommendation = this.generateRecommendation(result);

        console.log(`      ✅ Accessed via search - ${result.vulnerablePatterns.length} patterns found`);
      }
    } catch (searchError) {
      console.log(`      ❌ Search also failed: ${searchError.message}`);
    }
  }

  analyzeForVulnerabilities(content, filename) {
    const vulnerabilities = [];
    
    const vulnerabilityPatterns = [
      {
        pattern: /(\.pricePerShare\(\)|\.convertToAssets\(|vault\.pricePerShare)/g,
        type: 'Direct-Vault-Price-Call',
        description: 'Direct call to vault price functions without validation',
        severity: 'HIGH'
      },
      {
        pattern: /(totalAssets\s*\/\s*totalSupply|totalAssets\(\)\s*\/\s*totalSupply\(\))/g,
        type: 'Naive-Price-Calculation',
        description: 'Direct totalAssets/totalSupply calculation vulnerable to donation attacks',
        severity: 'CRITICAL'
      },
      {
        pattern: /(exchangeRate.*=.*totalSupply|getExchangeRate.*totalSupply)/g,
        type: 'Exchange-Rate-Manipulation',
        description: 'Vulnerable exchange rate calculation',
        severity: 'HIGH'
      },
      {
        pattern: /(getValue.*vault|getPrice.*vault|collateralValue.*vault|\.pricePerShare)/g,
        type: 'Vault-Collateral-Valuation',
        description: 'Vault collateral valuation - check for safe implementation',
        severity: 'MEDIUM_HIGH'
      },
      {
        pattern: /(ERC4626.*collateral|vault.*collateral|convertToAssets.*collateral)/g,
        type: 'ERC4626-Collateral-Integration',
        description: 'ERC4626 vault collateral integration point',
        severity: 'MEDIUM'
      },
      {
        pattern: /(function.*pricePerShare|function.*convertToAssets)/g,
        type: 'Price-Function-Detected',
        description: 'Price calculation functions found - needs manual review',
        severity: 'MEDIUM'
      }
    ];

    for (const pattern of vulnerabilityPatterns) {
      const matches = content.match(pattern.pattern);
      if (matches && matches.length > 0) {
        vulnerabilities.push({
          type: pattern.type,
          description: pattern.description,
          severity: pattern.severity,
          matches: matches.length,
          context: this.getCodeContext(content, pattern.pattern),
          exampleMatches: matches.slice(0, 2) // Show first 2 matches
        });
      }
    }

    return vulnerabilities;
  }

  getCodeContext(content, pattern, contextLines = 3) {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (pattern.test(lines[i])) {
        const start = Math.max(0, i - contextLines);
        const end = Math.min(lines.length, i + contextLines + 1);
        return lines.slice(start, end).join('\n');
      }
    }
    return 'Context not found';
  }

  checkMainnetIndicators(content) {
    const mainnetIndicators = [
      /mainnet/i,
      /ethereum.*mainnet/i,
      /deploy/i,
      /production/i,
      /live.*environment/i,
      /chainid.*1/i,
      /network.*mainnet/i
    ];

    return mainnetIndicators.some(indicator => indicator.test(content));
  }

  generateRecommendation(result) {
    if (result.vulnerablePatterns.length === 0) {
      return 'No obvious vulnerabilities found. Check implementation details manually.';
    }

    const criticalCount = result.vulnerablePatterns.filter(v => v.severity === 'CRITICAL').length;
    const highCount = result.vulnerablePatterns.filter(v => v.severity === 'HIGH').length;

    if (criticalCount > 0) {
      return `🚨 IMMEDIATE ACTION: ${criticalCount} CRITICAL vulnerabilities found!`;
    } else if (highCount > 0) {
      return `⚠️ HIGH PRIORITY: ${highCount} high-severity vulnerabilities found`;
    } else {
      return `📋 REVIEW NEEDED: ${result.vulnerablePatterns.length} integration points found`;
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  generateCriticalReport() {
    console.log('\n' + '='.repeat(80));
    console.log('🎯 CRITICAL FINDINGS ANALYSIS REPORT - FIXED');
    console.log('='.repeat(80));

    const accessibleTargets = this.analysisResults.filter(r => r.accessible);
    const vulnerableTargets = this.analysisResults.filter(r => r.vulnerablePatterns.length > 0);
    const criticalTargets = vulnerableTargets.filter(r => 
      r.vulnerablePatterns.some(v => v.severity === 'CRITICAL' || v.severity === 'HIGH')
    );

    console.log(`\n📊 ANALYSIS SUMMARY:`);
    console.log(`   Total targets analyzed: ${this.analysisResults.length}`);
    console.log(`   Accessible targets: ${accessibleTargets.length}`);
    console.log(`   Targets with vulnerabilities: ${vulnerableTargets.length}`);
    console.log(`   High/Critical risk targets: ${criticalTargets.length}`);

    if (criticalTargets.length > 0) {
      console.log('\n🚨 HIGHEST PRIORITY TARGETS FOUND:');
      console.log('─'.repeat(70));
      
      criticalTargets.forEach((target, index) => {
        console.log(`\n${index + 1}. ${target.repo}`);
        console.log(`   🔗 https://github.com/${target.repo}`);
        console.log(`   📄 ${target.file} (${target.exactPath})`);
        console.log(`   💀 Risk: ${target.risk}`);
        console.log(`   🎯 ${target.recommendation}`);
        console.log(`   📍 Mainnet Potential: ${target.mainnetPotential ? 'YES ⚠️' : 'Unknown'}`);
        
        // Show critical vulnerabilities
        target.vulnerablePatterns
          .filter(v => v.severity === 'CRITICAL' || v.severity === 'HIGH')
          .forEach(vuln => {
            console.log(`      🔥 ${vuln.type}`);
            console.log(`         ${vuln.description}`);
            console.log(`         Found ${vuln.matches} instances`);
          });
      });

      console.log('\n💼 BUSINESS OPPORTUNITY CONFIRMED!');
      console.log(`   You have ${criticalTargets.length} confirmed vulnerable targets!`);
      
    } else if (vulnerableTargets.length > 0) {
      console.log('\n⚠️ POTENTIAL TARGETS FOUND:');
      vulnerableTargets.forEach((target, index) => {
        console.log(`   ${index + 1}. ${target.repo} - ${target.vulnerablePatterns.length} patterns`);
      });
      console.log('\n💡 These need manual review to confirm exploitability');
      
    } else {
      console.log('\n❌ No vulnerable patterns detected in accessible files.');
      console.log('💡 The vulnerabilities might be in different files or more subtle implementations.');
      console.log('🚀 Try analyzing the actual vault implementations instead of collateral wrappers.');
    }

    // Show what we CAN access for manual review
    if (accessibleTargets.length > 0) {
      console.log('\n📋 ACCESSIBLE FILES FOR MANUAL REVIEW:');
      accessibleTargets.forEach(target => {
        console.log(`   ✅ ${target.repo} - ${target.file}`);
      });
    }
  }
}

// Run the fixed critical analysis
const analyzer = new CriticalFindingsAnalyzerFixed();
analyzer.analyzeCriticalTargets().catch(console.error);
