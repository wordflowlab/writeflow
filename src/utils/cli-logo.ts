import chalk from 'chalk'

import { debugLog, logError, logWarn, infoLog } from './log.js'
/**
import { debugLog, logError, logWarn, infoLog } from './log.js'

 * 显示WriteFlow的彩色ASCII Logo（CLI版本）
 */
export function displayCLILogo(): void {
  debugLog('')
  
  // WriteFlow ASCII 艺术 - 使用chalk渐变色彩
  debugLog(
    chalk.cyan('██   ██ ') +
    chalk.hex('#40E0D0')('████  ') +
    chalk.hex('#4169E1')('███ ') +
    chalk.hex('#6A5ACD')('█████ ') +
    chalk.hex('#8A2BE2')('█████   ') +
    chalk.hex('#BA55D3')('█████ ') +
    chalk.hex('#DA70D6')('█     ') +
    chalk.hex('#FF69B4')('████  ') +
    chalk.hex('#FFB6C1')('██   ██'),
  )
  
  debugLog(
    chalk.cyan('██   ██ ') +
    chalk.hex('#40E0D0')('█   █ ') +
    chalk.hex('#4169E1')(' █  ') +
    chalk.hex('#6A5ACD')('  █   ') +
    chalk.hex('#8A2BE2')('█       ') +
    chalk.hex('#BA55D3')('█     ') +
    chalk.hex('#DA70D6')('█     ') +
    chalk.hex('#FF69B4')('█   █ ') +
    chalk.hex('#FFB6C1')('██   ██'),
  )
  
  debugLog(
    chalk.cyan('██ █ ██ ') +
    chalk.hex('#40E0D0')('████  ') +
    chalk.hex('#4169E1')(' █  ') +
    chalk.hex('#6A5ACD')('  █   ') +
    chalk.hex('#8A2BE2')('████    ') +
    chalk.hex('#BA55D3')('████  ') +
    chalk.hex('#DA70D6')('█     ') +
    chalk.hex('#FF69B4')('█   █ ') +
    chalk.hex('#FFB6C1')('██ █ ██'),
  )
  
  debugLog(
    chalk.cyan('██ █ ██ ') +
    chalk.hex('#40E0D0')('█ █   ') +
    chalk.hex('#4169E1')(' █  ') +
    chalk.hex('#6A5ACD')('  █   ') +
    chalk.hex('#8A2BE2')('█       ') +
    chalk.hex('#BA55D3')('█     ') +
    chalk.hex('#DA70D6')('█     ') +
    chalk.hex('#FF69B4')('█   █ ') +
    chalk.hex('#FFB6C1')('██ █ ██'),
  )
  
  debugLog(
    chalk.cyan('███████ ') +
    chalk.hex('#40E0D0')('█  █  ') +
    chalk.hex('#4169E1')('███ ') +
    chalk.hex('#6A5ACD')('  █   ') +
    chalk.hex('#8A2BE2')('█████   ') +
    chalk.hex('#BA55D3')('█     ') +
    chalk.hex('#DA70D6')('█████ ') +
    chalk.hex('#FF69B4')('████  ') +
    chalk.hex('#FFB6C1')('███████'),
  )
  
  // 副标题
  debugLog('')
  debugLog(chalk.gray.dim('        ✍️ AI Writing Assistant'))
  debugLog('')
}

/**
 * 显示简化版Logo（单行）
 */
export function displayMiniLogo(): string {
  return (
    chalk.cyan('W') +
    chalk.hex('#40E0D0')('r') +
    chalk.hex('#4169E1')('i') +
    chalk.hex('#6A5ACD')('t') +
    chalk.hex('#8A2BE2')('e') +
    chalk.hex('#BA55D3')('F') +
    chalk.hex('#DA70D6')('l') +
    chalk.hex('#FF69B4')('o') +
    chalk.hex('#FFB6C1')('w')
  )
}