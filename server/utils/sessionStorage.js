import Cryptr from 'cryptr'
import Session from '../models/session'

const cryption = new Cryptr('123123123213')

export const storeCallback = async (session) => {
	const result = await Session.findOne({ id: session.id })

	if (result === null) {
		await Session.create({
			id: session.id,
			content: cryption.encrypt(JSON.stringify(session)),
			shop: session.shop
		})
	} else {
		await Session.findOneAndUpdate(
			{ id: session.id },
			{
				content: cryption.encrypt(JSON.stringify(session)),
				shop: session.shop
			}
		)
	}

	return true
}

export const loadCallback = async (id) => {
	const sessionResult = await Session.findOne({ id })
	if (sessionResult?.content?.length > 0) {
		return JSON.parse(cryption.decrypt(sessionResult.content))
	}
	return undefined
}

export const deleteCallback = async (id) => {
	await Session.deleteMany({ id })
	return true
}
