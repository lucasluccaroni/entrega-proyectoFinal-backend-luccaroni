const { Router } = require("express")

const { CartsDAO } = require("../dao/mongo/carts.dao")
const dao = new CartsDAO()

const { CartsService } = require("../service/carts-service")
const service = new CartsService(dao)

const { CartsController } = require("../controllers/carts.controllers")
const controller = new CartsController(service)

const { ProductsDAO } = require("../dao/mongo/products.dao")
const productsDAO = new ProductsDAO()

const { UsersDAO } = require("../dao/mongo/users.dao")
const usersDAO = new UsersDAO()

const { userShouldNotBeAdmin, userIsLoggedIn } = require("../middlewares/auth.middleware")


module.exports = () => {

    const router = Router()

    router.post("/:cid/products/:pid", userIsLoggedIn, (req, res, next) => {

        if (req.body._method === "PUT") {
            req.method = "PUT"

        } else if (req.body._method === "DELETE") {
            req.method = "DELETE"
        }
        next()
    })

    router.get("/", userIsLoggedIn, (req, res) => {
        controller.getCarts(req, res)
    })

    router.get("/:cid", userIsLoggedIn, async (req, res) => {
        const cart = await controller.getCartById(req, res)

        res.render("cart", {
            title: "Cart",
            cart,
            styles: [
                "cart.css"
            ],
            scripts: [
                "clearCart.js",
                "buyCart.js"
            ]
        })
    })

    router.post("/", userIsLoggedIn, (req, res) => {
        controller.createCart(req, res)
    })

    router.post("/:cid/products/:pid", userIsLoggedIn, userShouldNotBeAdmin, (req, res) => {
        controller.addProductToExistingCart(req, res)
    })

    router.put("/:cid/products/:pid", userIsLoggedIn, userShouldNotBeAdmin, (req, res) => {
        controller.updateProductFromExistingCart(req, res)
    })

    router.delete("/:cid/products/:pid", userIsLoggedIn, (req, res) => {
        controller.deleteProductFromExistingCart(req, res)
    })

    router.delete("/:cid", userIsLoggedIn, (req, res) => {
        controller.clearCart(req, res)
    })

    router.delete("/delete/:cid", userIsLoggedIn, (req, res) => {
        controller.deleteCart(req, res)
    })

    router.post("/:cid/purchase", userIsLoggedIn, (req, res) => {
        controller.purchaseCart(req, res)
    })

    // Vista de añadir un producto al carrito
    router.get("/add-product/:pid", userIsLoggedIn, async (req, res) => {

        const user = await usersDAO.getUserById(req.session.user.id)

        const cid = user.cart.toString()
        const pid = req.params.pid

        const product = await productsDAO.getProductById(pid)

        res.render("add-product-to-cart", {
            title: "Add product to cart",
            cid,
            product,
            styles: [
                "updateProductInCart.css"
            ]
        })
    })

    // Vista de editar la cantidad de un producto del carrito
    router.get("/update-product-in-cart/:pid", userIsLoggedIn, async (req, res) => {

        const pid = req.params.pid
        const product = await productsDAO.getProductById(pid)

        const user = await usersDAO.getUserById(req.session.user.id)
        const cid = user.cart.toString()

        res.render("update-product-in-cart", {
            title: "Update product quantity",
            cid,
            product,
            styles: [
                "updateProductInCart.css"
            ]
        })
    })

    // Vista de elimnar un producto del carrito
    router.get("/delete-product-in-cart/:pid", userIsLoggedIn, async (req, res) => {

        const pid = req.params.pid
        const product = await productsDAO.getProductById(pid)

        const user = await usersDAO.getUserById(req.session.user.id)
        const cid = user.cart.toString()

        res.render("delete-product-in-cart", {
            title: "Delete product",
            cid,
            product,
            styles: [
                "deleteProductInCart.css"
            ]
        })
    })

    return router
}