import ApolloClient from 'apollo-boost'
import { ApolloProvider } from 'react-apollo'
import App from 'next/app'
import { AppProvider } from '@shopify/polaris'
import { Provider, useAppBridge } from '@shopify/app-bridge-react'
import { authenticatedFetch } from '@shopify/app-bridge-utils'
import { Redirect } from '@shopify/app-bridge/actions'
import '@shopify/polaris/dist/styles.css'
import translations from '@shopify/polaris/locales/en.json'
import React from 'react'
import { GENERIC_ERROR_MSG, INACTIVE_JWT_MSG } from '../common/constants'

function userLoggedInFetch(app) {
	const fetchFunction = authenticatedFetch(app)

	const appFetch = async (uri, options, attempt = 10) => {
		let res
		try {
			res = await fetchFunction(uri, options)
		} catch (error) {
			// 1. Handle fetch error
			console.error(error)
			throw new CustomError(GENERIC_ERROR_MSG)
		}

		// 2. Handle 403 by redirecting browser
		const unauthHeader = res.headers.get(
			'X-Shopify-API-Request-Failure-Reauthorize'
		)
		if (unauthHeader === '1') {
			// eslint-disable-next-line no-undef
			const url = `https://${document.location.hostname}/auth?shop=${SHOP}`
			Redirect.create(app).dispatch(Redirect.Action.REMOTE, url)
			return null
		}

		if (res.status === 400) {
			try {
				// 3. Handle inactive jwt Shopify bug error
				const body = await res.clone().json()
				if (body.error === INACTIVE_JWT_MSG) {
					if (attempt > 0) {
						// Wait 1 second
						await new Promise((_) => setTimeout(_, 1000))
						return await appFetch(uri, options, attempt - 1)
					} else {
						throw new CustomError(GENERIC_ERROR_MSG)
					}
				}
			} catch (error) {}

			try {
				// 4. Handle koa-shopify-auth issue with redirection to "/auth"
				const contentType = res.headers.get('content-type')
				if (!contentType || contentType.includes('application/json'))
					return res
				const text = await res.clone().text()
				if (text === 'Expected a valid shop query parameter') {
					// - This does not include requests to /__nextjs_original-stack-frame
					// eslint-disable-next-line no-undef
					const url = `https://${document.location.hostname}/auth?shop=${SHOP}`
					Redirect.create(app).dispatch(Redirect.Action.REMOTE, url)
					return null
				}
			} catch (error) {}
		}

		return res
	}

	return appFetch
}

function MyProvider(props) {
	const app = useAppBridge()

	const client = new ApolloClient({
		fetch: userLoggedInFetch(app),
		fetchOptions: {
			credentials: 'include'
		}
	})

	const Component = props.Component

	return (
		<ApolloProvider client={client}>
			<Component {...props} />
		</ApolloProvider>
	)
}

class ErrorBoundary extends React.Component {
	state = { hasError: false }

	// eslint-disable-next-line shopify/react-prefer-private-members
	static getDerivedStateFromError(error) {
		return { hasError: true }
	}

	render() {
		if (this.state.hasError) {
			return <h1>Something went wrong.</h1>
		}

		return this.props.children
	}
}

class MyApp extends App {
	render() {
		const { Component, pageProps, host } = this.props
		return (
			<ErrorBoundary>
				<AppProvider i18n={translations}>
					<Provider
						config={{
							// eslint-disable-next-line no-undef
							apiKey: API_KEY,
							host: host,
							forceRedirect: true
						}}
					>
						<MyProvider Component={Component} {...pageProps} />
					</Provider>
				</AppProvider>
			</ErrorBoundary>
		)
	}
}

MyApp.getInitialProps = async ({ ctx }) => {
	return {
		host: ctx.query.host
	}
}

export default MyApp

export class CustomError extends Error {
	constructor(message) {
		super(message)
		this.name = 'CustomError'
	}
}
