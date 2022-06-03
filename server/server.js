import '@babel/polyfill'
import dotenv from 'dotenv'
import 'isomorphic-fetch'
import createShopifyAuth, { verifyRequest } from '@shopify/koa-shopify-auth'
import Shopify, { ApiVersion } from '@shopify/shopify-api'
import Koa from 'koa'
import next from 'next'
import Router from 'koa-router'
import mongoose from 'mongoose'
import {
	deleteCallback,
	loadCallback,
	storeCallback
} from './utils/sessionStorage'
import Session from './models/session'
import { INACTIVE_JWT_MSG } from '../common/constants'

dotenv.config()

// Database connection  //

const mongoUrl = process.env.MONGO_URI
const mongoOpts = {
	useNewUrlParser: true,
	useUnifiedTopology: true
}
mongoose.connect(mongoUrl, mongoOpts, (err) => {
	if (err) {
		console.log('--> Error connecting to MongoDB:', err.message)
	} else {
		console.log('--> Connected to MongoDB')
	}
})

// Server and app init //

const port = parseInt(process.env.PORT, 10) || 8081
const dev = process.env.NODE_ENV !== 'production'
const app = next({ dev })
const handle = app.getRequestHandler()

Shopify.Context.initialize({
	API_KEY: process.env.SHOPIFY_API_KEY,
	API_SECRET_KEY: process.env.SHOPIFY_API_SECRET,
	SCOPES: process.env.SCOPES.split(','),
	HOST_NAME: process.env.HOST.replace(/https:\/\//, ''),
	API_VERSION: ApiVersion.October20,
	IS_EMBEDDED_APP: true,
	SESSION_STORAGE: new Shopify.Session.CustomSessionStorage(
		storeCallback,
		loadCallback,
		deleteCallback
	)
})

const uninstallWebhookHandler = async (topic, shop, body) => {
	await Session.deleteMany({ shop })
	console.log(`--> Deleted records for ${shop}`)
}

Shopify.Webhooks.Registry.webhookRegistry.push({
	path: '/webhooks',
	topic: 'APP_UNINSTALLED',
	webhookHandler: uninstallWebhookHandler
})

app.prepare().then(async () => {
	const server = new Koa()
	const router = new Router()
	server.keys = [Shopify.Context.API_SECRET_KEY]
	server.use(
		createShopifyAuth({
			async afterAuth(ctx) {
				const { shop, accessToken, scope } = ctx.state.shopify
				const host = ctx.query.host

				const response = await Shopify.Webhooks.Registry.register({
					shop,
					accessToken,
					path: '/webhooks',
					topic: 'APP_UNINSTALLED',
					webhookHandler: uninstallWebhookHandler
				})

				if (!response.success) {
					console.log(
						`--> Failed to register APP_UNINSTALLED webhook: ${response.result}`
					)
				}
				ctx.redirect(`/?shop=${shop}&host=${host}`)
			}
		})
	)

	const handleRequest = async (ctx) => {
		await handle(ctx.req, ctx.res)
		ctx.respond = false
		ctx.res.statusCode = 200
	}

	router.post('/webhooks', async (ctx) => {
		try {
			await Shopify.Webhooks.Registry.process(ctx.req, ctx.res)
			console.log(`Webhook processed, returned status code 200`)
		} catch (error) {
			console.log(`Failed to process webhook: ${error}`)
		}
	})

	router.post(
		'/graphql',
		// verifyRequest({ returnHeader: true }),
		handleInvalidJwtErrorWrapper(verifyRequest({ returnHeader: true })),
		async (ctx, next) => {
			await Shopify.Utils.graphqlProxy(ctx.req, ctx.res)
		}
	)

	router.post('/init/promotions', async (ctx) => {
		// Works as a pre flight request
		ctx.res.statusCode = 200
	})

	router.get('(/_next/static/.*)', handleRequest)
	router.get('/_next/webpack-hmr', handleRequest)
	router.get('(.*)', async (ctx) => {
		const shop = ctx.query.shop
		const findShopCount = await Session.countDocuments({ shop })
		if (findShopCount < 2) {
			await Session.deleteMany({ shop })
			ctx.redirect(`/auth?shop=${shop}`)
		} else {
			await handleRequest(ctx)
		}
	})

	server.use(router.allowedMethods())
	server.use(router.routes())

	server.listen(port, () =>
		console.log(`> Ready on http://localhost:${port}`)
	)
})

function handleInvalidJwtErrorWrapper(cb) {
	return async (ctx, next) => {
		try {
			await cb(ctx, next)
		} catch (error) {
			if (error instanceof Shopify.Errors.InvalidJwtError) {
				ctx.response.status = 400
				ctx.response.body = { error: INACTIVE_JWT_MSG }
			} else {
				throw error
			}
		}
	}
}
