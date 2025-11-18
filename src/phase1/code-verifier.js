import 'dotenv/config';
import { Octokit } from '@octokit/rest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const octokit = new Octokit({ 
  auth: process.env.GITHUB_TOKEN
});

// Top 10 targets from our scan
const TOP_TARGETS = [
  'stalim17/openzeppelin-contracts',
  'stalim17/aave-v3-core', 
  'stalim17/v3-core',
  'racego/openzeppelin-contracts',
  'Timton909/openzeppelin-contracts',
  'DiammdM/openzeppelin-contracts',
  'nizarzulmi21/openzeppelin-contracts',
  'difof/openzeppelin-contracts',
  'gitnewplay-z/openzeppelin-contracts',
  'Larry-oss/openzeppelin-contracts'
];

// Vulnerable patterns to search for
const VULNERABLE_PATTERNS = {
  ERC4626_INFLATION: [
    /totalAssets\s*\/\s*totalSupply/,
    /pricePerShare\s*=\s*totalAssets\s*\/\s*totalSupply/,
    /convertToAssets.*1e18/,
    /function.*convertToAssets.*view.*returns.*uint256/
  ],
  SHARE_PRICE_MANIPULATION: [
    /exchangeRate.*=.*totalSupply/,
    /getExchangeRate.*totalAssets.*totalSupply/,
    /sharePrice.*=.*assets.*\/.*shares/
  ]
};

class CodeVerifier {
  constructor() {
    this.results = [];
  }

  async verifyTopTargets() {
    console.log('🔍 PHASE 1: MANUAL CODE VERIFICATION');
    console.log('='.repeat(60));
    console.log(`Verifying ${TOP_TARGETS.length} highest-risk repositories\n`);

    for (const target of TOP_TARGETS) {
      console.log(`\n🎯 VERIFYING: ${target}`);
      console.log('─'.repeat(50));
      
      const [owner, repo] = target.split('/');
      const verification = await this.verifyRepository(owner, repo);
      this.results.push(verification);
      
      // Rate limiting
      await this.delay(1000);
    }

    this.generateVerificationReport();
  }

  async verifyRepository(owner, repo) {
    const result = {
      repository: `${owner}/${repo}`,
      url: `https://github.com/${owner}/${repo}`,
      accessible: false,
      solidityFiles: [],
      vulnerabilities: [],
      criticalFindings: 0
    };

    try {
      // Get repository contents
      const { data: contents } = await octokit.rest.repos.getContent({
        owner,
        repo,
        path: ''
      });

      result.accessible = true;

      // Find all Solidity files
      const solidityFiles = await this.findSolidityFiles(owner, repo, contents);
      result.solidityFiles = solidityFiles.map(f => f.path);

      console.log(`   📄 Found ${solidityFiles.length} Solidity files`);

      // Check each file for vulnerabilities
      for (const file of solidityFiles.slice(0, 10)) { // Limit to first 10 files
        const fileVulnerabilities = await this.analyzeFile(owner, repo, file);
        result.vulnerabilities.push(...fileVulnerabilities);
      }

      result.criticalFindings = result.vulnerabilities.filter(v => v.severity === 'HIGH').length;

      if (result.criticalFindings > 0) {
        console.log(`   🚨 CRITICAL: ${result.criticalFindings} high-severity vulnerabilities found!`);
      } else if (result.vulnerabilities.length > 0) {
        console.log(`   ⚠️  WARNING: ${result.vulnerabilities.length} potential issues found`);
      } else {
        console.log(`   ✅ CLEAN: No obvious vulnerabilities detected`);
      }

    } catch (error) {
      console.log(`   ❌ ERROR: Cannot access repository - ${error.message}`);
      result.error = error.message;
    }

    return result;
  }

  async findSolidityFiles(owner, repo, contents, currentPath = '') {
    let solidityFiles = [];

    for (const item of contents) {
      if (item.type === 'file' && item.name.endsWith('.sol')) {
        solidityFiles.push({
          path: currentPath ? `${currentPath}/${item.name}` : item.name,
          name: item.name
        });
      } else if (item.type === 'dir') {
        // Recursively search directories (with depth limit)
        if (currentPath.split('/').length < 3) { // Limit depth to avoid rate limits
          try {
            const { data: dirContents } = await octokit.rest.repos.getContent({
              owner,
              repo,
              path: item.path
            });
            const subFiles = await this.findSolidityFiles(owner, repo, dirContents, item.path);
            solidityFiles.push(...subFiles);
          } catch (e) {
            // Skip if we can't access directory
          }
        }
      }
    }

    return solidityFiles;
  }

  async analyzeFile(owner, repo, file) {
    const vulnerabilities = [];

    try {
      const { data: fileContent } = await octokit.rest.repos.getContent({
        owner,
        repo,
        path: file.path
      });

      const content = Buffer.from(fileContent.content, 'base64').toString('utf8');
      
      // Check for ERC4626 inflation patterns
      for (const pattern of VULNERABLE_PATTERNS.ERC4626_INFLATION) {
        const matches = content.match(pattern);
        if (matches) {
          vulnerabilities.push({
            file: file.name,
            pattern: pattern.toString(),
            matches: matches.length,
            severity: 'HIGH',
            type: 'ERC4626-Inflation-Attack',
            description: 'Direct pricePerShare calculation vulnerable to donation attacks'
          });
        }
      }

      // Check for share price manipulation patterns
      for (const pattern of VULNERABLE_PATTERNS.SHARE_PRICE_MANIPULATION) {
        const matches = content.match(pattern);
        if (matches) {
          vulnerabilities.push({
            file: file.name,
            pattern: pattern.toString(),
            matches: matches.length,
            severity: 'HIGH', 
            type: 'Share-Price-Manipulation',
            description: 'Vulnerable exchange rate calculation'
          });
        }
      }

      // Check for specific dangerous functions
      if (content.includes('function pricePerShare') || content.includes('function convertToAssets')) {
        // Check if it uses safe math (virtual shares pattern)
        const hasVirtualShares = content.includes('_convertToAssets') || 
                                content.includes('virtualShares') ||
                                content.includes('initialExchangeRate');
        
        if (!hasVirtualShares) {
          vulnerabilities.push({
            file: file.name,
            pattern: 'pricePerShare/convertToAssets function',
            matches: 1,
            severity: 'MEDIUM',
            type: 'Potential-ERC4626-Risk',
            description: 'Price calculation functions found without obvious protection'
          });
        }
      }

    } catch (error) {
      console.log(`      �� Could not analyze ${file.name}: ${error.message}`);
    }

    return vulnerabilities;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  generateVerificationReport() {
    console.log('\n' + '='.repeat(80));
    console.log('📋 PHASE 1 VERIFICATION REPORT');
    console.log('='.repeat(80));

    const totalVulnerabilities = this.results.reduce((sum, repo) => sum + repo.vulnerabilities.length, 0);
    const totalCritical = this.results.reduce((sum, repo) => sum + repo.criticalFindings, 0);
    const accessibleRepos = this.results.filter(repo => repo.accessible).length;

    console.log(`\n📊 SUMMARY:`);
    console.log(`   Repositories analyzed: ${this.results.length}`);
    console.log(`   Accessible repositories: ${accessibleRepos}`);
    console.log(`   Total vulnerabilities found: ${totalVulnerabilities}`);
    console.log(`   Critical vulnerabilities: ${totalCritical}`);

    // Show repositories with critical findings
    const criticalRepos = this.results.filter(repo => repo.criticalFindings > 0);
    
    if (criticalRepos.length > 0) {
      console.log('\n🚨 REPOSITORIES WITH CRITICAL VULNERABILITIES:');
      console.log('─'.repeat(60));
      
      criticalRepos.forEach(repo => {
        console.log(`\n${repo.repository}`);
        console.log(`   🔗 ${repo.url}`);
        console.log(`   💀 Critical findings: ${repo.criticalFindings}`);
        console.log(`   📄 Files analyzed: ${repo.solidityFiles.length}`);
        
        // Show specific vulnerabilities
        const highVulns = repo.vulnerabilities.filter(v => v.severity === 'HIGH');
        highVulns.slice(0, 3).forEach(vuln => {
          console.log(`   🎯 ${vuln.type}: ${vuln.file} - ${vuln.description}`);
        });
      });
    }

    // Save detailed report
    const report = {
      verificationDate: new Date().toISOString(),
      targetsAnalyzed: TOP_TARGETS,
      results: this.results,
      summary: {
        totalRepos: this.results.length,
        accessibleRepos,
        totalVulnerabilities,
        totalCritical,
        criticalRepositories: criticalRepos.map(repo => repo.repository)
      }
    };

    if (!fs.existsSync('results/phase1')) {
      fs.mkdirSync('results/phase1', { recursive: true });
    }

    const reportFile = `results/phase1/code-verification-${Date.now()}.json`;
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));

    console.log(`\n📄 Detailed report saved to: ${reportFile}`);
    
    // Next steps
    console.log('\n🔮 NEXT STEPS FOR PHASE 1:');
    if (criticalRepos.length > 0) {
      console.log('   1. Focus on critical repositories for deep analysis');
      console.log('   2. Examine the actual vulnerable code patterns');
      console.log('   3. Check if these are custom implementations or direct forks');
      console.log('   4. Prepare for Phase 2 (mainnet deployment check)');
    } else {
      console.log('   1. All Top 10 targets analyzed');
      console.log('   2. Proceed to Phase 2 (mainnet deployment check)');
    }
  }
}

// Run the verification
const verifier = new CodeVerifier();
verifier.verifyTopTargets().catch(console.error);
