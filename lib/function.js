"use strict";
const {
    MessageType,
    WAMessageProto
} = require("@adiwajshing/baileys");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const fetch = require("node-fetch");
const FileType = require("file-type");
const moment = require("moment-timezone");
const { toAudio, toPTT, toVideo, convertSticker, mp4ToWebp } = require("./converter");
const isUrl = (url) => {
    return url.match(new RegExp(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)/, 'gi'))
}

exports.WAConnection = _WAConnection => {
    class WAConnection extends _WAConnection {
        constructor(...args) {
            super(...args)
            if (!Array.isArray(this._events['CB:action,add:relay,message'])) this._events['CB:action,add:relay,message'] = [this._events['CB:action,add:relay,message']]
            else this._events['CB:action,add:relay,message'] = [this._events['CB:action,add:relay,message'].pop()]
            this._events['CB:action,add:relay,message'].unshift(async function (json) {
                try {
                    let m = json[2][0][2]
                    if (m.message && m.message.protocolMessage && m.message.protocolMessage.type == 0) {
                        let key = m.message.protocolMessage.key
                        let c = this.chats.get(key.remoteJid)
                        let a = c.messages.dict[`${key.id}|${key.fromMe ? 1 : 0}`]
                        let participant = key.fromMe ? this.user.jid : a.participant ? a.participant : key.remoteJid
                        let WAMSG = WAMessageProto.WebMessageInfo
                        this.emit('message-delete', {
                            key,
                            participant,
                            message: WAMSG.fromObject(WAMSG.toObject(a))
                        })
                    }
                } catch (e) {}
            })
            this.browserDescription = ["example-bot", "IE", "6.9"]
            this.on(`CB:action,,battery`, json => {
                this.battery = json[2][0][1]
            })
        }
        
        async sendImageAsSticker(jid, stickerData, quot, options = {}) {
	let packname = options.pack || global['config'].packName
	let author = options.author || global['config'].authName
	convertSticker(stickerData, author, packname)
		.then(res => {
			let imageBuffer = new Buffer.from(res, "base64");
			this.sendMessage(jid, imageBuffer, 'stickerMessage', {
				quoted: quot
			})
		})
		.catch(err => {
			throw err
			this.sendMessage(jid, require('util').format(err), 'conversation', {
				quoted: quot
			})
		})
}

		async sendMp4AsSticker(jid, stickerData, quot, options = {}) {
	let packname = options.pack || global['config'].packName
	let author = options.author || global['config'].authName
	mp4ToWebp(stickerData, author, packname)
		.then(res => {
			let imageBuffer = new Buffer.from(
				res.split(";base64,")[1],"base64");
			this.sendMessage(jid, imageBuffer, 'stickerMessage', {
				quoted: quot
			})
		})
		.catch(err => {
			throw err
			this.sendMessage(jid, require('util').format(err), 'conversation', {
				quoted: quot
			})
		})
}

        /**
         * To send Message from Content
         * @param {String} jid 
         * @param {String} message 
         * @param {Object} options 
         * @returns WAMesaage
         */
        async sendMessageFromContent(jid, message, options) {
            var option = {
                contextInfo: {},
                ...options
            }
            var prepare = await this.prepareMessageFromContent(jid, message, option)
            await this.relayWAMessage(prepare)
            return prepare
        }

        /**
         * Send Contact
         * @param {String} jid 
         * @param {String|Number} number 
         * @param {String} name 
         * @param {Object} quoted 
         * @param {Object} options 
         */
        async sendContact(jid, number, name, quoted, options) {
            // TODO: Business Vcard
            number = number.replace(/[^0-9]/g, '')
            let njid = number + '@s.whatsapp.net'
            let {
                isBusiness
            } = await this.isOnWhatsApp(njid) || {
                isBusiness: false
            }
            let vcard = 'BEGIN:VCARD\n' + 'VERSION:3.0\n' + 'FN:' + name + '\n' + 'ORG:Kontak\n' + 'TEL;type=CELL;type=VOICE;waid=' + number + ':+' + number + '\n' + 'END:VCARD'.trim()
            return await this.sendMessage(jid, {
                displayName: name,
                vcard
            }, 'contactMessage', {
                quoted,
                ...options
            })
        }

        /**
         * To send Sticker from Buffer or Url
         * @param {String} from 
         * @param {Buffer} buffer 
         * @param {Object} msg 
         * @returns WAMessage
         */
        sendSticker(from, buffer, msg) {
            if (typeof buffer == 'string' && isUrl(buffer)) {
                return this.sendMessage(
                    from, {
                        url: buffer
                    },
                    'stickerMessage', {
                        quoted: msg
                    }
                )
            } else {
                return this.sendMessage(
                    from,
                    buffer,
                    'stickerMessage', {
                        quoted: msg
                    }
                )
            }
        }

        /**
         * To send Audio from Buffer or Url
         * @param {String} from 
         * @param {Buffer} buffer 
         * @param {Object} msg 
         * @param {Boolean} isPtt 
         * @returns WAMessage
         */
        sendAudio(from, buffer, msg, isPtt) {
            if (typeof buffer == 'string' && isUrl(buffer)) {
                return this.sendMessage(
                    from, {
                        url: buffer
                    },
                    'audioMessage', {
                        quoted: msg,
                        ptt: isPtt || false
                    }
                )
            } else {
                return this.sendMessage(
                    from,
                    buffer,
                    'audioMessage', {
                        quoted: msg,
                        ptt: isPtt || false
                    }
                )
            }
        }

        /**
         * To send Image from Buffer or Url
         * @param {String} from 
         * @param {Buffer} buffer 
         * @param {String} capt 
         * @param {Object} msg 
         * @param {Object} men 
         * @returns WAMessage
         */
        sendImage(from, buffer, capt = '', msg = '', men = []) {
            if (typeof buffer == 'string' && isUrl(buffer)) {
                return this.sendMessage(
                    from, {
                        url: buffer
                    },
                    'imageMessage', {
                        caption: capt,
                        quoted: msg,
                        contextInfo: {
                            mentionedJid: men
                        }
                    }
                )
            } else {
                return this.sendMessage(
                    from,
                    buffer,
                    'imageMessage', {
                        caption: capt,
                        quoted: msg,
                        contextInfo: {
                            mentionedJid: men
                        }
                    }
                )
            }
        }

        /**
         * To send Video from Buffer or Url
         * @param {String} from 
         * @param {Buffer} buffer 
         * @param {String} capt 
         * @param {Object} msg 
         * @param {Object} men 
         * @returns WAMessage
         */
        sendVideo(from, buffer, capt = '', msg = '', men = []) {
            if (typeof buffer == 'string' && isUrl(buffer)) {
                return this.sendMessage(
                    from, {
                        url: buffer
                    },
                    'videoMessage', {
                        caption: capt,
                        quoted: msg,
                        contextInfo: {
                            mentionedJid: men
                        }
                    }
                )
            } else {
                return this.sendMessage(
                    from,
                    buffer,
                    'videoMessage', {
                        caption: capt,
                        quoted: msg,
                        contextInfo: {
                            mentionedJid: men
                        }
                    }
                )
            }
        }

        /**
         * To check Invite code from Link Group
         * @param {String} code 
         * @returns 
         */
        async cekInviteCode(code) {
            let link = code.split('com')[1]
            let response = await this.query({ json: ['query', 'invite', link], expect200: true })
        return response
        }

        async getQuotedMsg(msg) {
            if (!msg.isQuotedMsg) return false
            let ai = await this.loadMessage(msg.key.remoteJid, msg.quotedMsg.id)
            return await exports.serialize(this, ai)
        }
        
        /**
         * Get name from jid
         * @param {String} jid 
         */
        getName(jid) {
            let info = this.contacts[jid]
            let pushname = jid == this.user.jid ?
                this.user.name :
                !info ?
                jid.split('@')[0] :
                info.short ||
                info.notify ||
                info.vname ||
                info.name ||
                jid.split('@')[0]
            return pushname
        }
        
    /**
     * getBuffer hehe
     * @param {String|Buffer} path
     */
    async getFile(path) {
      let res
      let data = Buffer.isBuffer(path) ? path : /^data:.*?\/.*?;base64,/i.test(path) ? Buffer.from(path.split`,`[1], 'base64') : /^https?:\/\//.test(path) ? await (res = await fetch(path)).buffer() : fs.existsSync(path) ? fs.readFileSync(path) : typeof path === 'string' ? path : Buffer.alloc(0)
      if (!Buffer.isBuffer(data)) throw new TypeError('Result is not a buffer')
      let type = await FileType.fromBuffer(data) || {
        mime: 'application/octet-stream',
        ext: '.bin'
      }

      return {
        res,
        ...type,
        data
      }
    }

    /**
     * Send Media/File with Automatic Type Specifier
     * @param {String} jid
     * @param {String|Buffer} path
     * @param {String} filename
     * @param {String} caption
     * @param {Object} quoted
     * @param {Boolean} ptt
     * @param {Object} options
     */
    async sendFile(jid, path, filename = '', caption = '', quoted, ptt = false, options = {}) {
      let type = await this.getFile(path)
      let { res, data: file } = type
      if (res && res.status !== 200 || file.length <= 65536) {
        try { throw { json: JSON.parse(file.toString()) } }
        catch (e) { if (e.json) throw e.json }
      }
      let opt = { filename, caption }
      if (quoted) opt.quoted = quoted
      if (!type) if (options.asDocument) options.asDocument = true
      let mtype = ''
      if (options.asSticker) mtype = MessageType.sticker
      else if (!options.asDocument && !options.type) {
        if (options.force) file = file
        else if (/audio/.test(type.mime)) file = await (ptt ? toPTT : toAudio)(file, type.ext)
        else if (/video/.test(type.mime)) file = await toVideo(file, type.ext)
        if (/webp/.test(type.mime) && file.length <= 1 << 20) mtype = MessageType.sticker
        else if (/image/.test(type.mime)) mtype = MessageType.image
        else if (/video/.test(type.mime)) mtype = MessageType.video
        else opt.displayName = opt.caption = filename
        if (options.asGIF && mtype === MessageType.video) mtype = MessageType.gif
        if (/audio/.test(type.mime)) {
          mtype = MessageType.audio
          if (!ptt) opt.mimetype = 'audio/mp4'
          opt.ptt = ptt
        } else if (/pdf/.test(type.ext)) mtype = MessageType.pdf
        else if (!mtype) {
          mtype = MessageType.document
          opt.mimetype = type.mime
        }
      } else {
        mtype = options.type ? options.type : MessageType.document
        opt.mimetype = type.mime
      }
      delete options.asDocument
      delete options.asGIF
      delete options.asSticker
      delete options.type
      if (mtype === MessageType.document) opt.title = filename
      if (mtype === MessageType.sticker || !opt.caption) delete opt.caption
      return await this.sendMessage(jid, file, mtype, { ...opt, ...options })
    }

        /**
         * To Reply message
         * @param {String} jid 
         * @param {String} text 
         * @param {Object} quoted 
         * @param {Object} options 
         * @returns WAMessage
         */
        reply(jid, text, quoted, options) {
            return this.sendMessage(jid, text, 'extendedTextMessage', {
                quoted,
                ...options
            })
        }
    }
    return WAConnection
}

exports.serialize = async (xinz, msg) => {
    if (msg.message["ephemeralMessage"]) {
        msg.message = msg.message.ephemeralMessage.message
        msg.ephemeralMessage = true

    } else {
        msg.ephemeralMessage = false
    }
    msg.isGroup = msg.key.remoteJid.endsWith('@g.us')
    try {
        const berak = Object.keys(msg.message)[0]
        msg.type = berak
    } catch {
        msg.type = null
    }
    try {
        const context = msg.message[msg.type].contextInfo.quotedMessage
        if (context["ephemeralMessage"]) {
            msg.quotedMsg = context.ephemeralMessage.message
        } else {
            msg.quotedMsg = context
        }
        msg.isQuotedMsg = true
        msg.quotedMsg.sender = msg.message[msg.type].contextInfo.participant
        msg.quotedMsg.fromMe = msg.quotedMsg.sender === xinz.user.jid ? true : false
        msg.quotedMsg.type = Object.keys(msg.quotedMsg)[0]
        let ane = msg.quotedMsg
        msg.quotedMsg.body = (ane.type === 'conversation' && ane.conversation) ? ane.conversation : (ane.type == 'imageMessage') && ane.imageMessage.caption ? ane.imageMessage.caption : (ane.type == 'documentMessage') && ane.documentMessage.caption ? ane.documentMessage.caption : (ane.type == 'videoMessage') && ane.videoMessage.caption ? ane.videoMessage.caption : (ane.type == 'extendedTextMessage') && ane.extendedTextMessage.text ? ane.extendedTextMessage.text : ''
        msg.quotedMsg.id = msg.message[msg.type].contextInfo.stanzaId
        msg.quotedMsg.isBaileys = msg.quotedMsg.id.startsWith('3EB0') && msg.quotedMsg.id.length === 12
        msg.isQuotedImage = msg.quotedMsg.type == MessageType.image
        msg.isQuotedVideo = msg.quotedMsg.type == MessageType.video
        msg.isQuotedSticker = msg.quotedMsg.type == MessageType.sticker
        msg.isQuotedAudio = msg.quotedMsg.type == MessageType.audio
        msg.isQuotedDocument = msg.quotedMsg.type == MessageType.document
        msg.isQuotedMedia = msg.isQuotedImage || msg.isQuotedVideo || msg.isQuotedSticker || msg.isQuotedAudio || msg.isQuotedDocument || false
        msg.quotedMsg.getMsg = async () => {
            let anu = await xinz.loadMessage(msg.key.remoteJid, msg.quotedMsg.id)
            return JSON.parse(JSON.stringify(anu))
        }
        msg.quotedMsg.toBuffer = async () => {
            let anu = await xinz.loadMessage(msg.key.remoteJid, msg.quotedMsg.id)
            return await xinz.downloadMediaMessage(anu)
        }
    } catch {
        msg.quotedMsg = null
        msg.isQuotedMsg = false
    }

    try {
        const mention = msg.message[msg.type].contextInfo.mentionedJid
        msg.mentioned = mention
    } catch {
        msg.mentioned = []
    }

    if (msg.isGroup) {
        msg.sender = msg.participant
    } else {
        msg.sender = msg.key.remoteJid
    }
    if (msg.key.fromMe) {
        msg.sender = xinz.user.jid
    }

    msg.from = msg.key.remoteJid
    msg.fromMe = msg.key.fromMe
    msg.isBaileys = msg.key.id.startsWith('3EB0') && msg.key.id.length === 12

    const conts = msg.key.fromMe ? xinz.user.jid : xinz.contacts[msg.sender]
    msg.pushname = msg.key.fromMe ? xinz.user.name : !conts ? msg.sender.split('@')[0] : conts.notify || conts.short || conts.vname || conts.name || msg.sender.split('@')[0]

    let chat = (msg.type === 'conversation' && msg.message.conversation) ? msg.message.conversation : (msg.type == 'imageMessage') && msg.message.imageMessage.caption ? msg.message.imageMessage.caption : (msg.type == 'documentMessage') && msg.message.documentMessage.caption ? msg.message.documentMessage.caption : (msg.type == 'videoMessage') && msg.message.videoMessage.caption ? msg.message.videoMessage.caption : (msg.type == 'extendedTextMessage') && msg.message.extendedTextMessage.text ? msg.message.extendedTextMessage.text : (msg.type == 'listResponseMessage') && msg.message.listResponseMessage.singleSelectReply.selectedRowId ? msg.message.listResponseMessage.singleSelectReply.selectedRowId : (msg.type == 'buttonsResponseMessage') && msg.message.buttonsResponseMessage.selectedButtonId ? msg.message.buttonsResponseMessage.selectedButtonId: ''

    msg.body = chat
    const groupMetadata = msg.isGroup ? await xinz.groupMetadata(msg.from) : false
    const isOwner = global['config'].ownerNumber.includes(msg.sender)
    const pushname = msg.pushname
    const admin = msg.isGroup ? exports.getGroupAdmins(groupMetadata.participants) : ''
    const isAdmin = msg.isGroup ? admin.includes(msg.sender) : false
    msg.isImage = msg.type == MessageType.image
    msg.isVideo = msg.type == MessageType.video
    msg.isSticker = msg.type == MessageType.sticker
    msg.isAudio = msg.type == MessageType.audio
    msg.isDocument = msg.type == MessageType.document
    msg.isMedia = msg.isImage || msg.isVideo || msg.isSticker || msg.isAudio || msg.isDocument || false

    const a = {
        isOwner,
        pushname,
        isAdmin
    }
    msg.userData = a
    if (groupMetadata) msg.groupMetadata = groupMetadata
    msg.toBuffer = async () => {
        return await xinz.downloadMediaMessage(msg)
    }
    return msg
}

exports.generateMessageID = () => {
    return '3EB0' + randomBytes(7).toString('hex').toUpperCase()
}
exports.sleep = async (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
}
exports.getGroupAdmins = function (participants) {
    let admins = []
    for (let i of participants) {
        i.isAdmin ? admins.push(i.jid) : ''
    }
    return admins
}
exports.processTime = (timestamp, now) => {
	return moment.duration(now - moment(timestamp * 1000)).asSeconds()
}
exports.pickRandom = (list) => {
	return list[Math.floor(Math.random() * list.length)]
}
exports.parseMention = (text = '') => {
    return [...text.matchAll(/@([0-9]{5,16}|0)/g)].map(v => v[1] + '@s.whatsapp.net')
}
exports.formatDate = (n, locale = 'id') => {
  let d = new Date(n)
  return d.toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric'
  })
}
exports.runtime = (ms) => {
	ms = Number(ms);
	var d = Math.floor(ms / (3600 * 24));
	var h = Math.floor(ms % (3600 * 24) / 3600);
	var m = Math.floor(ms % 3600 / 60);
	var s = Math.floor(ms % 60);
	var dDisplay = d > 0 ? d + (d == 1 ? " Hari " : " Hari ") : "";
	var hDisplay = h > 0 ? h + (h == 1 ? " Jam " : " Jam ") : "";
	var mDisplay = m > 0 ? m + (m == 1 ? " Menit " : " Menit ") : "";
	var sDisplay = s > 0 ? s + (s == 1 ? " Detik" : " Detik") : "";
	return dDisplay + hDisplay + mDisplay + sDisplay;
}
exports.clockString = (ms) => {
  let h = isNaN(ms) ? '--' : Math.floor(ms % (3600 * 24) / 3600)
  let m = isNaN(ms) ? '--' : Math.floor(ms % 3600 / 60)
  let s = isNaN(ms) ? '--' : Math.floor(ms % 60)
  return [h, m, s].map(v => v.toString().padStart(2, 0)).join(':')
}
exports.getBuffer = async (url, options) => {
	try {
		options ? options : {}
		const res = await axios({
			method: "get",
			url,
			headers: {
				'DNT': 1,
				'Upgrade-Insecure-Request': 1
			},
			...options,
			responseType: 'arraybuffer'
		})
		return res.data
	} catch (e) {
		throw e
	}
}
exports.fetchJson = (url, options) => new Promise(async (resolve, reject) => {
    fetch(url, options)
        .then(response => response.json())
        .then(json => {
            resolve(json)
        })
        .catch((err) => {
            reject(err)
        })
})
