# Loto App

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE.md)

Custom Shopify app to add include loto results on the POS cart.

## Installation on server

1. Create a custom app on the Partners dashboard

2. Create a MongoDB database and update .env URL

3. Deploy on Heroku

```sh
~/ $ shopify node deploy heroku
```

4. Add environment variables

## Installation on store

1. Create a product with tag \_loto, tax-free, published on the POS channel, 0 price, non-trackable
2. Open it and get the ID (number) from the URL bar
3. Store the SOURCE_LOTO_PRODUCT_ID environment variable with a value: gid://shopify/Product/[the number id] , on the server (e.g. Heroku project page > Settings > Env. Vars.)
4. Install the app

## Requirements

-   Works on Shopify POS
-   One store allowed per deployment

## Usage

1. Add products to cart
2. Visit the app's tile on the Homepage
3. Add the amount of loto to be paid by the customer and submit
4. Go to the cart page
5. The app automatically deletes up to 2 generated loto products every time it's opened, for cleanup

## License

This respository is available as open source under the terms of the [MIT License](https://opensource.org/licenses/MIT).
/
