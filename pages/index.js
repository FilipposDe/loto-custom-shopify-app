import {
	Button,
	Card,
	Frame,
	ProgressBar,
	InlineError,
	Layout,
	Page,
	TextField,
	Toast,
	TextContainer,
	Stack,
	Collapsible,
	Banner
} from '@shopify/polaris'
import { useAppBridge, Modal } from '@shopify/app-bridge-react'
import { Cart, Pos, Features } from '@shopify/app-bridge/actions'
import { useQuery } from 'react-apollo'
import React from 'react'
import { LOTO_PRODUCTS_QUERY } from '../common/graphQLQueries'
import {
	LOTO_TAG,
	LOTO_TITLE,
	LOTO_SUBMIT_STATE,
	MODES,
	DISCOUNT_SUBMIT_STATE,
	DISCOUNT_TITLE,
	DISCOUNT_DESCRIPTION
} from '../common/constants'
import {
	useSettingsToggle,
	useInstructionsToggle,
	useMutations
} from '../common/hooks'
import {
	getDeletableLotoProducts,
	getDisplayErrorMessage,
	getDeleteMutationArgs,
	getUpdateMutationArgs,
	getDisplayLotoProductsCount,
	getDuplicateMutationArgs,
	isDateBeforeToday,
	getDiscountData,
	attemptGetCartPriceData
} from '../common/helpers'

// eslint-disable-next-line no-undef
const sourceProductId = SOURCE_ID

const Index = () => {
	const app = useAppBridge()
	const cart = Cart.create(app)

	const [debugArray, setDebugArray] = React.useState([])
	const [lotoPrice, setLotoPrice] = React.useState('')
	const [discountPrice, setDiscountPrice] = React.useState('')
	const [message, setMessage] = React.useState('')
	const [error, setError] = React.useState('')
	const [newProductId, setNewProductId] = React.useState(null)
	const [mode, setMode] = React.useState(MODES.UNSET)
	const [cartPrices, setCartPrices] = React.useState({})
	const [submitProgress, setSubmitProgress] = React.useState(
		LOTO_SUBMIT_STATE.INIT
	)

	const { isInstructionsOpen, toggleInstructions } = useInstructionsToggle()
	const { isSettingsOpen, toggleSettings } = useSettingsToggle()

	const {
		duplicate,
		update,
		delete_,
		duplicateError,
		updateError,
		deleteError,
		deleteLoading
	} = useMutations()

	const { data: lotoProductsData, refetch: refetchLotoProducts } =
		useQuery(LOTO_PRODUCTS_QUERY)

	const deleteAllLotoProducts = async () => {
		if (!lotoProductsData || submitProgress.loading) return

		const products = lotoProductsData?.products?.edges?.map(
			(edge) => edge.node
		)

		const productsToDelete = getDeletableLotoProducts(
			products,
			sourceProductId,
			newProductId
		)

		const promises = productsToDelete.map(async (product) => {
			await delete_(getDeleteMutationArgs(product))
		})

		await Promise.all(promises)

		// TODO refetch
	}

	const deleteOldLotoProducts = async () => {
		if (!lotoProductsData || submitProgress.loading || !sourceProductId)
			return

		const products = lotoProductsData?.products?.edges?.map(
			(edge) => edge.node
		)

		const productsToDelete = getDeletableLotoProducts(
			products,
			sourceProductId,
			newProductId
		).filter((product) => {
			return isDateBeforeToday(
				product['createdAt'],
				new Date().toUTCString()
			)
		})

		const promises = productsToDelete.map(async (product) => {
			await delete_(getDeleteMutationArgs(product))
		})

		await Promise.all(promises)

		// TODO refetch
	}

	React.useEffect(() => {
		if (lotoProductsData) {
			try {
				deleteOldLotoProducts()
			} catch (error) {
				console.error(error)
			}
		}
	}, [lotoProductsData])

	React.useEffect(() => {
		if (!sourceProductId) {
			setError('Please provide a source product ID on the .env file.')
		}

		app.error((data) => {
			// Hack - hide initial attempt to get cart price error
			if (data?.action?.type === 'APP::CART::FETCH') return
			setError('Error: ' + data.message)
		})

		app.featuresAvailable().then((features) => {
			// Done 1. once initially
			// without feature check and...
			attemptGetCartPriceData(cart, null, setCartPrices, setError)
		})

		const newFeaturesUnsubscribe = app.subscribe(
			Features.Action.UPDATE,
			() => {
				app.featuresAvailable().then((features) => {
					// ... 2. once with Features subscription
					attemptGetCartPriceData(
						cart,
						features,
						setCartPrices,
						setError,
						newFeaturesUnsubscribe
					)
				})
			}
		)
	}, [])

	const submitLoto = async () => {
		// ----- Initialize -----

		setMode(MODES.LOTO)
		setMessage('')
		setError('')
		setNewProductId('')
		setSubmitProgress(LOTO_SUBMIT_STATE.INIT)

		// ----- Validate price -----

		if (Number(lotoPrice) <= 0 || isNaN(lotoPrice)) {
			setError('Invalid price')
			setSubmitProgress(LOTO_SUBMIT_STATE.INIT)
			return
		}

		setSubmitProgress(LOTO_SUBMIT_STATE.DUPLICATING)

		// ----- Create product -----

		const duplicateRes = await duplicate(
			getDuplicateMutationArgs(sourceProductId, LOTO_TITLE, false)
		)

		const resProductId =
			duplicateRes?.data?.productDuplicate?.newProduct?.id

		if (!resProductId) {
			setError(
				'Shopify API Error: unable to duplicate the Source product.'
			)
			setSubmitProgress(LOTO_SUBMIT_STATE.INIT)
			return
		}

		setSubmitProgress(LOTO_SUBMIT_STATE.SETTING_PRICE)

		const updateRes = await update(
			getUpdateMutationArgs(resProductId, lotoPrice)
		)

		const variantId =
			updateRes?.data?.productUpdate?.product?.variants?.edges?.[0]?.node
				?.id

		if (!variantId) {
			setError('Shopify API Error: unable to update the new product.')
			setSubmitProgress(LOTO_SUBMIT_STATE.INIT)

			return
		}

		setSubmitProgress(LOTO_SUBMIT_STATE.ADDING_TO_CART)

		// ----- Set listener -----

		const cartUpdatesUnsubscribe = cart.subscribe(
			Cart.Action.UPDATE,
			function (payload) {
				const hasNewItem = payload?.data?.lineItems?.map(
					(item) => item.variantId === variantId
				)
				if (!hasNewItem) return

				// ----- Handle success  -----

				cartUpdatesUnsubscribe()
				setNewProductId(resProductId)
				setMessage('Done!')
				setSubmitProgress(LOTO_SUBMIT_STATE.INIT)
			}
		)

		// ----- Dispatch action (ADD_LINE_ITEM) -----

		cart.dispatch(Cart.Action.ADD_LINE_ITEM, {
			data: {
				variantId: Number(variantId.split('/')[4]),
				quantity: 1
			}
		})
	}

	const submitDiscount = async () => {
		// ----- Initialize -----

		setMode(MODES.DISCOUNT)
		setMessage('')
		setError('')
		setNewProductId('')
		setSubmitProgress(DISCOUNT_SUBMIT_STATE.INIT)

		// ----- Validate price -----

		if (Number(discountPrice) <= 0 || isNaN(discountPrice)) {
			setError('Invalid price')
			setSubmitProgress(DISCOUNT_SUBMIT_STATE.INIT)
			return
		}

		// ----- Calculate discount -----

		const { shopifyDiscount, productTitlePrice } = getDiscountData(
			cartPrices,
			Number(discountPrice)
		)

		const needsDiscountProduct = Boolean(productTitlePrice)

		let resProductId = null
		let variantId = null

		const currencyFormatter = new Intl.NumberFormat('en-CA', {
			style: 'currency',
			currency: 'CAD'
		})

		if (needsDiscountProduct) {
			// ----- Create product (if needed) -----

			setSubmitProgress(DISCOUNT_SUBMIT_STATE.DUPLICATING)

			const title = `${DISCOUNT_TITLE} ${currencyFormatter.format(
				productTitlePrice
			)}`

			const duplicateRes = await duplicate(
				getDuplicateMutationArgs(sourceProductId, title, true)
			)

			resProductId = duplicateRes?.data?.productDuplicate?.newProduct?.id

			if (!resProductId) {
				setError(
					'Shopify API Error: unable to duplicate the Source product.'
				)
				setSubmitProgress(DISCOUNT_SUBMIT_STATE.INIT)
				return
			}

			setSubmitProgress(DISCOUNT_SUBMIT_STATE.SETTING_PRICE)

			const updateRes = await update(
				getUpdateMutationArgs(resProductId, 0)
			)

			variantId =
				updateRes?.data?.productUpdate?.product?.variants?.edges?.[0]
					?.node?.id

			if (!variantId) {
				setError(
					'Shopify API Error: unable to update the new discount product.'
				)
				setSubmitProgress(DISCOUNT_SUBMIT_STATE.INIT)
				return
			}
		}

		// ----- Set listener -----

		const cartUpdatesUnsubscribe = cart.subscribe(
			Cart.Action.UPDATE,
			function (payload) {
				let hasNewProduct = false
				if (needsDiscountProduct) {
					hasNewProduct = payload?.data?.lineItems?.map(
						(item) => item.variantId === variantId
					)
				}

				const hasNewDiscount =
					payload?.data?.cartDiscount?.discountDescription?.startsWith(
						DISCOUNT_DESCRIPTION
					)

				// TODO handle error case
				if (
					(shopifyDiscount > 0 && !hasNewDiscount) ||
					(needsDiscountProduct && !hasNewProduct)
				) {
					return
				}

				// ----- Handle success  -----

				cartUpdatesUnsubscribe()
				if (needsDiscountProduct) setNewProductId(resProductId)
				setMessage('Done!')
				setSubmitProgress(DISCOUNT_SUBMIT_STATE.INIT)
			}
		)

		// ----- Dispatch action(s) (SET_DISCOUNT, ADD_LINE_ITEM) -----

		setSubmitProgress(DISCOUNT_SUBMIT_STATE.ADDING_TO_CART)

		if (shopifyDiscount > 0) {
			cart.dispatch(Cart.Action.SET_DISCOUNT, {
				data: {
					amount: Number(Number(shopifyDiscount).toFixed(2)),
					discountDescription: `${DISCOUNT_DESCRIPTION} ${currencyFormatter.format(
						discountPrice
					)}`,
					type: 'flat'
				}
			})
		}

		if (needsDiscountProduct) {
			cart.dispatch(Cart.Action.ADD_LINE_ITEM, {
				data: {
					variantId: Number(variantId.split('/')[4]),
					quantity: 1
				}
			})
		}
	}

	const closeApp = () => {
		const pos = Pos.create(app)
		pos.dispatch(Pos.Action.CLOSE)
	}

	const errorMessage = getDisplayErrorMessage(
		duplicateError,
		updateError,
		error,
		deleteError && 'Error deleting unneeded Loto products'
	)

	const deleteCount = getDisplayLotoProductsCount(
		lotoProductsData?.products?.edges?.map((edge) => edge.node),
		sourceProductId,
		newProductId
	)

	const currencyFormatter = new Intl.NumberFormat('en-CA', {
		style: 'currency',
		currency: 'CAD'
	})

	const cartPriceCurrency = currencyFormatter.format(cartPrices.total)

	return (
		<Frame>
			<Page>
				<Layout>
					{submitProgress.message && (
						<ProgressBar progress={submitProgress.stage} />
					)}

					<Layout.Section>
						{process.env.NODE_ENV !== 'production' && (
							<p>Debug message: {JSON.stringify(debugArray)}</p>
						)}
						{mode !== MODES.DISCOUNT && (
							<Card title="Loto" sectioned>
								<TextField
									label="Loto"
									value={lotoPrice}
									onChange={(v) => setLotoPrice(v)}
									autoComplete="off"
									disabled={submitProgress.loading}
									inputMode="decimal"
									id="loto-input"
									name="loto-input"
									type="currency"
									min={0}
								/>

								<br />
								<Button
									loading={false}
									fullWidth
									disabled={
										Number(lotoPrice) <= 0 ||
										submitProgress.message
									}
									onClick={() => submitLoto()}
									primary
								>
									{submitProgress.message ||
										`Add Loto amount`}
								</Button>
								<br />
								<InlineError
									message={errorMessage}
									fieldID="error-msg"
								/>
							</Card>
						)}

						{mode !== MODES.LOTO && (
							<Card title="Discount" sectioned>
								{!submitProgress.message && (
									<>
										<Banner
											title="Please make sure all other cart items have been added first."
											status="warning"
										/>
										<br />
									</>
								)}

								<TextField
									label={`Discount amount (Cart Total: ${cartPriceCurrency})`}
									value={discountPrice}
									onChange={(v) => setDiscountPrice(v)}
									autoComplete="off"
									disabled={submitProgress.loading}
									inputMode="decimal"
									id="discount-input"
									name="discount-input"
									type="currency"
									min={0}
								/>

								<br />
								<Button
									loading={false}
									fullWidth
									disabled={
										Number(cartPrices.total) < 0 ||
										// Number(cartPrices.total) <= 0 ||
										Number(discountPrice) <= 0 ||
										submitProgress.message
									}
									onClick={() => submitDiscount()}
									primary
								>
									{submitProgress.message ||
										'Add Discount amount'}
								</Button>
								<br />

								<InlineError
									message={errorMessage}
									fieldID="error-msg"
								/>
							</Card>
						)}

						<br />
						{message && (
							<Toast
								content={message}
								duration={10000}
								action={{
									onAction: () => closeApp(),
									id: 'action-exit',
									content: 'Back to homepage'
								}}
								onDismiss={() => setMessage('')}
							/>
						)}
					</Layout.Section>
					<Layout.Section>
						<Card title="Settings" sectioned>
							<Button
								onClick={toggleSettings}
								ariaExpanded={isSettingsOpen}
								ariaControls="basic-collapsible"
							>
								{isSettingsOpen
									? 'Hide settings'
									: 'Show settings'}
							</Button>

							<Collapsible
								open={isSettingsOpen}
								id="basic-collapsible-sett"
								transition={{
									duration: '500ms',
									timingFunction: 'ease-in-out'
								}}
							>
								<Card.Section title="Manual delete">
									<TextContainer>
										Manually delete all generated products
										with the &quot;{LOTO_TAG}
										&quot; tag. Source product is excluded.
										If a new Loto product was just
										generated, it is also excluded.
									</TextContainer>
									<br />

									<Button
										loading={deleteLoading}
										fullWidth
										disabled={
											submitProgress.loading ||
											!deleteCount
										}
										onClick={() => deleteAllLotoProducts()}
										destructive
									>
										Delete all Loto products ({deleteCount})
									</Button>
								</Card.Section>
								<Card.Section title="Installation instructions">
									<Stack vertical>
										<Button
											onClick={toggleInstructions}
											ariaExpanded={isInstructionsOpen}
											ariaControls="basic-collapsible"
										>
											{isInstructionsOpen
												? 'Hide'
												: 'Show'}
										</Button>
										<Collapsible
											open={isInstructionsOpen}
											id="basic-collapsible-instr"
											transition={{
												duration: '500ms',
												timingFunction: 'ease-in-out'
											}}
										>
											<TextContainer>
												<ol>
													<li>
														Create a product with
														tag _loto, tax-free,
														published on the POS
														channel, 0 price,
														non-trackable
													</li>
													<li>
														Open it and get the ID
														(number) from the URL
														bar
													</li>
													<li>
														Store the
														SOURCE_LOTO_PRODUCT_ID
														environment variable
														with a value:
														gid://shopify/Product/[the
														number id] , on the
														server (e.g. Heroku
														project page gt;
														Settings gt; Env. Vars.)
													</li>
												</ol>
											</TextContainer>
										</Collapsible>
									</Stack>
								</Card.Section>
							</Collapsible>
						</Card>
					</Layout.Section>
				</Layout>
			</Page>
		</Frame>
	)
}

export default Index
