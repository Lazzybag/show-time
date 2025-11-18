import 'dotenv/config';
import { Octokit } from '@octokit/rest';

const octokit = new Octokit({ 
  auth: process.env.GITHUB_TOKEN
});

// CRITICAL TARGETS FROM YOUR SEARCH RESULTS
const CRITICAL_TARGETS = [
  {
    repo: 'reserve-protocol/protocol',
    file: 'ERC4626FiatCollateral.sol',
    risk: 'VERY_HIGH',
    reason: 'Direct ERC4626 collateral implementation'
  },
  {
    repo: 'yieldprotocol/vault-v2', 
    file: 'YearnVaultMultiOracle.sol',
    risk: 'HIGH',
    reason: 'Vault price oracle - potential direct pricePerShare usage'
  },
  {
    repo: 'curvance/Curvance-CantinaCompetition',
    file: 'CTokenPrimitive.sol',
    risk: 'HIGH', 
    reason: 'Collateral token with vault integration'
  },
  {
    repo: 'sturdyfi/sturdy-contracts',
    file: 'ERC4626Vault.sol',
    risk: 'HIGH',
    reason: 'Explicit ERC4626 vault implementation'
  },
  {
    repo: 'arcadia-finance/arcadia-lending',
    file: 'LendingPool.sol',
    risk: 'MEDIUM_HIGH',
    reason: 'Lending pool with potential vault collateral'
  },
  {
    repo: 'timeless-fi/yield-daddy',
    file: 'AaveV2ERC4626.sol',
    risk: 'MEDIUM',
    reason: 'Aave v2 ERC4626 wrapper - check price calculations'
  }
];

class CriticalFindingsAnalyzer {
  constructor() {
    this.analysisResults = [];
  }

  async analyzeCriticalTargets() {
    console.log('🔍 CRITICAL FINDINGS ANALYSIS - PHASE 2');
    console.log('='.repeat(70));
    console.log('Analyzing the most promising targets from your search results...\n');

    for (const target of CRITICAL_TARGETS) {
      console.log(`🎯 ANALYZING: ${target.repo}`);
      console.log(`   📄 File: ${target.file}`);
      console.log(`   ⚠️  Risk: ${target.risk} - ${target.reason}`);
      
      const analysis = await this.analyzeTarget(target);
      this.analysisResults.push(analysis);
      
      console.log('   '.padEnd(50, '─'));
      await this.delay(1000);
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
      recommendation: ''
    };

    try {
      // Get the specific file content
      const { data: fileContent } = await octokit.rest.repos.getContent({
        owner,
        repo,
        path: this.findFilePath(owner, repo, target.file)
      });

      result.accessible = true;
      const content = Buffer.from(fileContent.content, 'base64').toString('utf8');
      
      // Analyze for specific vulnerability patterns
      result.vulnerablePatterns = this.analyzeForVulnerabilities(content, target.file);
      
      // Check for mainnet indicators
      result.mainnetPotential = this.checkMainnetIndicators(content);
      
      // Generate recommendation
      result.recommendation = this.generateRecommendation(result);

      console.log(`   ✅ Accessible - ${result.vulnerablePatterns.length} vulnerability patterns found`);
      if (result.vulnerablePatterns.length > 0) {
        result.vulnerablePatterns.forEach(pattern => {
          console.log(`      💀 ${pattern.type}: ${pattern.description}`);
        });
      }

    } catch (error) {
      console.log(`   ❌ Cannot access: ${error.message}`);
      result.error = error.message;
    }

    return result;
  }

  findFilePath(owner, repo, targetFile) {
    // Common paths where these files might be located
    const possiblePaths = [
      `contracts/${targetFile}`,
      `src/${targetFile}`, 
      `src/contracts/${targetFile}`,
      `contracts/src/${targetFile}`,
      targetFile // Direct path
    ];

    // For now, return the most likely path - in real implementation we'd try each
    return possiblePaths[0];
  }

  analyzeForVulnerabilities(content, filename) {
    const vulnerabilities = [];
    
    const vulnerabilityPatterns = [
      {
        pattern: /\.pricePerShare\(\)|\.convertToAssets\(|vault\.pricePerShare/,
        type: 'Direct-Vault-Price-Call',
        description: 'Direct call to vault price functions without validation',
        severity: 'HIGH'
      },
      {
        pattern: /totalAssets\s*\/\s*totalSupply/,
        type: 'Naive-Price-Calculation',
        description: 'Direct totalAssets/totalSupply calculation vulnerable to donation attacks',
        severity: 'CRITICAL'
      },
      {
        pattern: /exchangeRate.*=.*totalSupply/,
        type: 'Exchange-Rate-Manipulation',
        description: 'Vulnerable exchange rate calculation',
        severity: 'HIGH'
      },
      {
        pattern: /getValue.*vault|getPrice.*vault|collateralValue.*vault/,
        type: 'Vault-Collateral-Valuation',
        description: 'Custom vault collateral valuation - check for safe implementation',
        severity: 'MEDIUM_HIGH'
      },
      {
        pattern: /ERC4626.*collateral|vault.*collateral/,
        type: 'ERC4626-Collateral-Integration',
        description: 'Explicit ERC4626 vault collateral support',
        severity: 'MEDIUM'
      }
    ];

    for (const pattern of vulnerabilityPatterns) {
      if (pattern.pattern.test(content)) {
        vulnerabilities.push({
          type: pattern.type,
          description: pattern.description,
          severity: pattern.severity,
          context: this.getCodeContext(content, pattern.pattern)
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
    // Check for indicators that this might be deployed on mainnet
    const mainnetIndicators = [
      /mainnet/,
      /ethereum.*mainnet/,
      /deploy/,
      /production/,
      /live.*environment/
    ];

    return mainnetIndicators.some(indicator => indicator.test(content.toLowerCase()));
  }

  generateRecommendation(result) {
    if (result.vulnerablePatterns.length === 0) {
      return 'No obvious vulnerabilities found. Check implementation details manually.';
    }

    const criticalCount = result.vulnerablePatterns.filter(v => v.severity === 'CRITICAL').length;
    const highCount = result.vulnerablePatterns.filter(v => v.severity === 'HIGH').length;

    if (criticalCount > 0) {
      return `🚨 IMMEDIATE ACTION: ${criticalCount} CRITICAL vulnerabilities found. High priority for security audit.`;
    } else if (highCount > 0) {
      return `⚠️ HIGH PRIORITY: ${highCount} high-severity vulnerabilities. Recommend security review.`;
    } else {
      return `📋 MEDIUM PRIORITY: ${result.vulnerablePatterns.length} potential issues. Consider code review.`;
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  generateCriticalReport() {
    console.log('\n' + '='.repeat(80));
    console.log('�� CRITICAL FINDINGS ANALYSIS REPORT');
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
      console.log('\n🚨 HIGHEST PRIORITY TARGETS FOR YOUR SECURITY SERVICES:');
      console.log('─'.repeat(70));
      
      criticalTargets.forEach((target, index) => {
        console.log(`\n${index + 1}. ${target.repo}`);
        console.log(`   🔗 https://github.com/${target.repo}`);
        console.log(`   📄 ${target.file}`);
        console.log(`   💀 Risk: ${target.risk}`);
        console.log(`   🎯 Recommendation: ${target.recommendation}`);
        console.log(`   📍 Mainnet Potential: ${target.mainnetPotential ? 'YES ⚠️' : 'Unknown'}`);
        
        target.vulnerablePatterns.forEach(vuln => {
          if (vuln.severity === 'CRITICAL' || vuln.severity === 'HIGH') {
            console.log(`      🔥 ${vuln.type}: ${vuln.description}`);
          }
        });
      });

      console.log('\n💼 BUSINESS OPPORTUNITY IDENTIFIED!');
      console.log(`   You have ${criticalTargets.length} high-value potential clients!`);
      console.log('\n🎯 NEXT STEPS:');
      console.log('   1. Contact these projects for security audit services');
      console.log('   2. Prepare proof-of-concept exploits for demonstration');
      console.log('   3. Consider responsible disclosure if vulnerabilities are confirmed');
      console.log('   4. Focus on projects with mainnet deployment potential');
    } else {
      console.log('\n❌ No critical vulnerabilities found in initial analysis.');
      console.log('💡 The vulnerabilities might be more subtle - need deeper code review.');
    }
  }
}

// Run the critical findings analysis
const analyzer = new CriticalFindingsAnalyzer();
analyzer.analyzeCriticalTargets().catch(console.error);
