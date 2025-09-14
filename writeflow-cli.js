#!/usr/bin/env node

/**
 * WriteFlow 智能启动器 - 实现跨平台兼容性设计
 * 
 * 解决 Windows 下的 ESM 模块加载问题：
 * - 优先使用编译后的纯 Node.js 版本 (Windows 最佳)
 * - 回退到 tsx 直接运行 (开发环境)
 * - 提供详细的错误处理和用户指导
 * 
 * 3层启动回退机制：
 * 1. dist/cli/writeflow-cli.js (编译后，Windows 友好)
 * 2. tsx + src/cli/writeflow-cli.ts (开发环境)
 * 3. 错误处理和诊断信息
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

// ES 模块中的 __dirname 替代方案
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 获取启动参数
const args = process.argv.slice(2);
const srcEntry = path.join(__dirname, 'src', 'cli', 'writeflow-cli.ts');
const distEntry = path.join(__dirname, 'dist', 'cli', 'writeflow-cli.js');

// Windows 平台检测
const isWindows = process.platform === 'win32';

/**
 * 方法1: 优先使用编译后的 dist 版本 (Windows 最佳)
 */
function tryDistVersion() {
  if (fs.existsSync(distEntry)) {
    console.log('✅ 使用编译版本 (Windows 友好)');
    
    const child = spawn(process.execPath, [distEntry, ...args], {
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_ENV: process.env.NODE_ENV || 'production'
      },
      // Windows 专用设置
      shell: false, // 编译版本不需要 shell
      windowsHide: false
    });

    child.on('exit', code => {
      process.exit(code || 0);
    });

    child.on('error', (error) => {
      console.warn(`⚠️  编译版本启动失败: ${error.message}`);
      console.log('🔄 尝试开发环境启动...');
      tryTsxVersion();
    });

    return true;
  }
  return false;
}

/**
 * 方法2: 使用 tsx 运行 TypeScript 源码 (开发环境)
 */
function tryTsxVersion() {
  // 检查 tsx 是否可用
  try {
    execSync('tsx --version', { stdio: 'ignore' });
    
    console.log('✅ 使用开发环境 (tsx + TypeScript)');
    
    const child = spawn('tsx', [srcEntry, ...args], {
      stdio: 'inherit',
      shell: isWindows, // Windows 需要 shell
      env: {
        ...process.env,
        NODE_ENV: process.env.NODE_ENV || 'development',
        // Windows 专用 ESM 配置
        ...(isWindows ? {
          TSX_TSCONFIG_PATH: path.join(__dirname, 'tsconfig.json'),
          NODE_OPTIONS: '--enable-source-maps'
        } : {})
      }
    });

    child.on('exit', code => {
      process.exit(code || 0);
    });

    child.on('error', (error) => {
      console.error(`❌ tsx 启动失败: ${error.message}`);
      showInstallationGuide();
    });

    return true;
  } catch (error) {
    console.warn('⚠️  tsx 不可用，正在安装...');
    return tryInstallTsx();
  }
}

/**
 * 方法3: 尝试安装 tsx 并重试
 */
function tryInstallTsx() {
  try {
    console.log('📦 正在安装 tsx...');
    
    // 尝试本地安装 tsx
    execSync('npm install tsx --save-dev', { 
      stdio: 'inherit',
      cwd: __dirname 
    });
    
    console.log('✅ tsx 安装成功，重新启动...');
    return tryTsxVersion();
    
  } catch (error) {
    console.error('❌ tsx 安装失败');
    showInstallationGuide();
    return false;
  }
}

/**
 * 显示安装指南和诊断信息
 */
function showInstallationGuide() {
  console.log('\n' + '='.repeat(60));
  console.log('🚨 WriteFlow 启动失败 - Windows ESM 兼容性问题');
  console.log('='.repeat(60));
  
  console.log('\n📋 诊断信息:');
  console.log(`   操作系统: ${process.platform} ${process.arch}`);
  console.log(`   Node.js: ${process.version}`);
  console.log(`   工作目录: ${process.cwd()}`);
  console.log(`   编译版本: ${fs.existsSync(distEntry) ? '✅ 存在' : '❌ 缺失'}`);
  
  console.log('\n🔧 解决方案:');
  console.log('\n方案1: 构建编译版本 (推荐)');
  console.log('   npm run build');
  console.log('   node writeflow-cli.js');
  
  console.log('\n方案2: 安装开发依赖');
  console.log('   npm install tsx --save-dev');
  console.log('   npx tsx src/cli.ts');
  
  console.log('\n方案3: 全局安装 tsx');
  console.log('   npm install -g tsx');
  console.log('   tsx src/cli.ts');
  
  console.log('\n📞 如需帮助:');
  console.log('   GitHub: https://github.com/wordflowlab/writeflow');
  console.log('   Issues: https://github.com/wordflowlab/writeflow/issues');
  
  // Windows 专用提示
  if (isWindows) {
    console.log('\n🪟 Windows 专用提示:');
    console.log('   1. 确保使用 PowerShell 或 CMD (不推荐 Git Bash)');
    console.log('   2. 以管理员身份运行可能解决权限问题');
    console.log('   3. 检查 PATH 环境变量是否包含 Node.js');
  }
  
  console.log('\n' + '='.repeat(60));
  process.exit(1);
}

/**
 * 主启动逻辑
 */
function main() {
  try {
    // 优先级1: 尝试编译后的版本
    if (tryDistVersion()) {
      return;
    }
    
    // 优先级2: 尝试 tsx 开发版本
    console.log('📝 编译版本不存在，使用开发模式...');
    if (tryTsxVersion()) {
      return;
    }
    
    // 优先级3: 显示安装指南
    showInstallationGuide();
    
  } catch (error) {
    console.error('💥 启动过程中出现意外错误:');
    console.error(error);
    showInstallationGuide();
  }
}

// 处理意外退出
process.on('SIGINT', () => {
  console.log('\n👋 WriteFlow 已退出');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 WriteFlow 已终止');
  process.exit(0);
});

// 启动应用
main();