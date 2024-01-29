const fs = require('fs')
const path = require('path')
const md5 = require('md5')
const chalk = require('chalk')
const pinyin = require('pinyin')
import { getConfig } from './config'
const apiConfig = getConfig()
/** C#的类型转为 TS的类型 */
export function transCSharpTypeToTyscriptType(origintype, format) {
	const typeEnmu = {
		integer: 'number',
		string: 'string',
		boolean: 'boolean',
		number: 'number',
		array: '[]',
		object: 'any',
		int64: 'string',
		int32: 'number',
		date: 'string',
		'date-time': 'string',
		t: 'T',
		double: 'number',
	}
	if (format) {
		return typeEnmu[format.toLocaleLowerCase()]
	} else {
		return typeEnmu[origintype.toLocaleLowerCase()]
	}
}
// 判断字符串中是否至少含有一个汉字
function containsChineseChar(str) {
	var chineseRegex = /[\u4e00-\u9fa5]/
	return chineseRegex.test(str.replace(/[^\u4e00-\u9fa5]/g, ''))
}

/** 获取引用类型名称 */
export function getModeleType(str) {
	const s = str.replace('#/definitions/', '')
	// if (containsChineseChar(s)) {
	// 	return pinyin(s, { style: 0 }).flat().join('')
	// }
	return s
}
export function definitionsToEnglish(obj) {
	// 递归的基础情况：如果传入的对象不是对象，直接返回
	if (typeof obj !== 'object' || obj === null) {
		return obj
	}

	// 递归地转换对象中的每一个属性
	for (let key in obj) {
		// 如果是对象属性，递归转换属性值
		if (typeof obj[key] === 'object') {
			obj[key] = definitionsToEnglish(obj[key])
		} else if (typeof obj[key] === 'string' && key !== 'description') {
			// 如果属性值是字符串，转换为拼音
			obj[key] = pinyin(obj[key], { style: 0 }).join('')
			//
			if (obj[key].includes('«')) {
				obj[key] = obj[key].replaceAll(/\«|\»/g, '')
			}
		}

		if (containsChineseChar(key) && key !== 'description' && key !== 'title') {
			const definitionsPinyin = pinyin(key, { style: 0 }).flat().join('')
			obj[definitionsPinyin] = JSON.parse(JSON.stringify(obj[key]))
		}
	}
	console.log(obj)
	return obj
}

/** 写入文件 */
export function writeFile(name, data, dirname) {
	if (!fs.existsSync(path.resolve(process.cwd() + dirname))) {
		fs.mkdirSync(path.resolve(process.cwd() + dirname))
	}
	const filePath = path.resolve(process.cwd() + dirname, name + '.ts')
	fs.writeFileSync(filePath, data)
	prettierFiles(filePath)
}

const prettier = require('prettier')
const prettierConfigPath = require.resolve(
	apiConfig.prettierUrl ? path.resolve(process.cwd() + apiConfig.prettierUrl) : '../.prettierrc.yml',
)
/** 格式化文件 */
const prettierFiles = file => {
	const options = prettier.resolveConfig.sync(file, {
		config: prettierConfigPath,
	})
	const fileInfo = prettier.getFileInfo.sync(file)
	if (fileInfo.ignored) {
		return
	}
	try {
		const input = fs.readFileSync(file, 'utf8')
		const withParserOptions = {
			...options,
			parser: fileInfo.inferredParser,
		}
		const output = prettier.format(input, withParserOptions)
		if (output !== input) {
			fs.writeFileSync(file, output, 'utf8')
		}
	} catch (e) {
		console.log('格式化出错了', file)
	}
}

/** 校正文件(删除无用的文件) */
export function correctionFile(dirname, list, module, type) {
	let dataFiles = list.map(i => i + '.ts').sort((a, b) => a.localeCompare(b))
	let currentFiles = fs.readdirSync(path.resolve(process.cwd() + dirname)).sort((a, b) => a.localeCompare(b))
	if (dataFiles.join() !== currentFiles.join()) {
		if (Array.from(new Set(dataFiles)).length > Array.from(new Set(currentFiles)).length) {
			console.log('看看是不是哪里出错了~~~~~~', dirname)
		} else {
			currentFiles.forEach(fileName => {
				if (!dataFiles.includes(fileName)) {
					fs.unlinkSync(path.resolve(process.cwd() + dirname + '/' + fileName))
					removeCache(type, module + '/' + fileName.split('.')[0])
					console.log(chalk.redBright('删除了' + dirname + '/' + fileName))
				}
			})
		}
	}
}

/** 检查是否存在文件夹 */
export function checkOutputDirExit(outputDir) {
	let dirList = outputDir.split('/').filter(i => i)
	if (!fs.existsSync(path.resolve(process.cwd() + outputDir))) {
		if (outputDir === '/port.lock.json') {
			fs.writeFileSync(path.resolve(process.cwd() + outputDir), '{"enum":{},"type":{},"api":{},"tag":{}}')
		} else {
			let url = ''
			dirList.forEach(dir => {
				url += '/' + dir
				if (!fs.existsSync(path.resolve(process.cwd() + url))) {
					fs.mkdirSync(path.resolve(process.cwd() + url))
				}
			})
		}
	}
}

/** 获取Tag名称 */
export function getTagName(str) {
	if (str.length === 0) {
		throw new Error('无所属模块')
	} else {
		return str[0]
	}
}

function removeCache(type, key) {
	if (apiConfig.cache) {
		const cacheData = require(path.resolve(process.cwd() + '/port.lock.json'))
		delete cacheData[type][key]
		fs.writeFileSync(path.resolve(process.cwd() + '/port.lock.json'), JSON.stringify(cacheData, null, 2))
	}
}
/** 判断是否需要更新 */
export function checkIsNeedUpdate(type, key, value) {
	if (apiConfig.cache) {
		const cacheData = require(path.resolve(process.cwd() + '/port.lock.json'))
		//如果缓存有，进去比较hash
		if (cacheData[type][key]) {
			if (cacheData[type][key] !== md5(JSON.stringify(value))) {
				cacheData[type][key] = md5(JSON.stringify(value))
				fs.writeFileSync(path.resolve(process.cwd() + '/port.lock.json'), JSON.stringify(cacheData, null, 2))
				return true
			} else {
				return false
			}
		} else {
			//如果没有，创建hash
			cacheData[type][key] = md5(JSON.stringify(value))
			fs.writeFileSync(path.resolve(process.cwd() + '/port.lock.json'), JSON.stringify(cacheData, null, 2))
			return true
		}
	} else {
		return true
	}
}

/** 获取依赖的enum和model */
export function findDefinitions(target, usedEnum, usedModel, enumMap, modelMap, isDeep = true) {
	target.forEach(i => {
		if (i.definitions.length) {
			i.definitions.forEach(j => {
				if (enumMap[j] && !usedEnum.includes(j)) {
					usedEnum.push(j)
				} else if (modelMap[j] && !usedModel.includes(j)) {
					usedModel.push(j)
					if (isDeep) {
						findDefinitions([modelMap[j]], usedEnum, usedModel, enumMap, modelMap)
					}
				}
			})
		}
	})
}

module.exports = {
	transCSharpTypeToTyscriptType,
	getModeleType,
	writeFile,
	checkOutputDirExit,
	getTagName,
	checkIsNeedUpdate,
	correctionFile,
	findDefinitions,
	definitionsToEnglish,
}
