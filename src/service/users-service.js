const { hashPassword } = require("../utils/hashing")
const { transport } = require("../utils/nodemailer")

const UserModel = require("../dao/models/user.model")
const { UsersDTO } = require("../dao/dtos/users.dto")

const { ErrorCodes } = require("./errors/errorCodes")
const { CustomError } = require("./errors/CustomError")
const errors = require("./errors/errors")
const { logger } = require("../logger/logger")

const jwt = require("jsonwebtoken")
const { privateKey } = require("../config")
const bcrypt = require("bcrypt")

class UsersService {
    constructor(dao) {
        this.dao = dao
    }

    async getUsers(query, sort, limit, page) {

        let users = await this.dao.getUsers()
        if (!users) {
            throw CustomError.createError({
                name: "Database Error",
                cause: "Database problem caused failure in opreation",
                message: errors.databaseProblem(),
                code: ErrorCodes.DATABASE_ERROR
            })
        }

        // Paginacion para enviar al controller
        users = await UserModel.paginate(
            query,
            {
                sort: sort && { age: sort },
                limit,
                page,
                lean: true
            }
        )

        // Transformacion de usuarios usando DTO
        let usersTransformed = await users.docs.map(u => {
            const dto = new UsersDTO(u)
            const transformation = dto.transform()
            return transformation
        })
        users.docs = usersTransformed
        return users
    }

    async sendResetEmail(email) {

        const token = jwt.sign({ email }, privateKey, { expiresIn: "1h" })
        console.log("TOKEN CREADO EN sendResetEmail => ", token)

        const resetLink = `pfinal-backend-luccaroni-production.up.railway.app/new-reset-password?token=${token}`

        return await transport.sendMail({
            from: "luccaroni@gmail.com",
            to: `${email}`,
            subject: "Password recovery service.",
            html: `
                <div>
                    <h2> Genere una nueva conraseña </h2>
                    <p> Haga clic en el siguiente enlace para restablecer su contraseña. </p> 
                    <a href="${resetLink}"> Click aqui </a>
                    <p> Si no ve el boton, copie y pegue el siguiente enlace (sin los corchetes [])  </p>
                    <p> ${resetLink} </p>
                </div>
                `
        })
    }

    async newResetPassword(token, password) {
        try {
            // Verifico el token
            const tokenInfo = jwt.verify(token, privateKey)
            console.log("TOKEN VERIFICATION => ", tokenInfo)

            // Busco al usuario
            const user = await this.dao.getUserByEmail(tokenInfo.email)
            if (!user) {
                throw CustomError.createError({
                    name: "Not Found ",
                    cause: "User Not Found in Database",
                    message: errors.generateInvalidUserEmailError(),
                    code: ErrorCodes.INVALID_TYPES_ERROR
                })
            }

            // Verifico que la nueva contraseña no sea la misma que la previa
            const samePassword = await bcrypt.compare(password, user.password)
            if (samePassword) {
                throw CustomError.createError({
                    name: "Same password ",
                    cause: "Old password and new password are equals.",
                    message: errors.generateSamePasswordError(),
                    code: ErrorCodes.UNAUTHORIZED
                })
            }

            // Si esta todo bien, hasheo la nueva contraseña
            const hashedPassword = hashPassword(password)

            // Actuializo la nueva contraseña
            const resetPassword = await this.dao.resetUserPassword(tokenInfo.email, hashedPassword)

            return resetPassword
        }
        catch (err) {
            logger.error(`ERROR EN USERS SERVICE => ${err.message}`)
            console.log(err)
            return null
        }
    }

    async getUserById(id) {
        const user = this.dao.getUserById(id)
        return user
    }

    async changeRole(id) {

        // Busco al usuario
        const user = await this.getUserById(id)
        if (!user) {
            throw CustomError.createError({
                name: "Not Found ",
                cause: "User Not Found in Database",
                message: errors.generateInvalidUserIdError(id),
                code: ErrorCodes.INVALID_TYPES_ERROR
            })
        }
        console.log("CANTIDAD DE DOCUMENTOS DEL USER => ", user.documents.length)
        // Me fijo si tiene suficientes documentos cargados (3) para pasar a usuario premium 
        if (user.documents.length < 3) {
            throw CustomError.createError({
                name: "Unauthorized to change roles.",
                cause: "Insufficient documents in your acount",
                message: errors.generateInsufficientDocumentsError(),
                code: ErrorCodes.UNAUTHORIZED
            })
        }

        console.log(user)
        // Me fijo que rol tiene
        const userRole = user.role
        logger.debug(`Rol: ${userRole}`)

        // Defino que Rol se va a mandar al DAO para actualizar, de acuerdo a que rol tenga ahora el user
        let newUserRole
        if (userRole === "user") {
            newUserRole = "premium"
        } else if (userRole === "premium") {
            newUserRole = "user"
        }

        // Mando al DAO la actualizacion de Rol
        const changeRole = await this.dao.changeRole(id, newUserRole)
        return `New user role: ${newUserRole}`
    }


    async uploadDocuments(files, userId) {

        // Busco al user por su id
        const user = await this.dao.getUserById(userId)
        if (!user) {
            throw CustomError.createError({
                name: "Not Found ",
                cause: "User Not Found in Database",
                message: errors.generateInvalidUserIdError(id),
                code: ErrorCodes.INVALID_TYPES_ERROR
            })
        }

        // Extraigo el nombre y el path de el/los documento/s, que seran cargados al User en la DB
        const processedFiles = files.map((img) => {
            const { originalname, path } = img
            return { docName: originalname, docReference: path }
        })
        console.log(processedFiles)


        // Valido que los archivos contengan alguna de las palabras claves: "adress", "status" o "identification"
        const docNameValidation = processedFiles.every(document => {
            const allowedWords = ["status", "adress", "identification"]
            return allowedWords.some(word => document.docName.includes(word))
        })
        console.log("DOCUMENT VALIDATION => ", docNameValidation)
        if (!docNameValidation) {
            throw CustomError.createError({
                name: "Wrong file names.",
                cause: "Wrong file names.",
                message: errors.generateWrongFileNamesError(),
                code: ErrorCodes.UNAUTHORIZED
            })
        }

        // Le cargo la imagen al user en la DB
        const uploadDocuments = this.dao.uploadDocuments(userId, processedFiles)
        return uploadDocuments
    }

    async updateLastConnection(userId) {
        
        // Busco al user por su id
        const user = await this.dao.getUserById(userId)
        if (!user) {
            throw CustomError.createError({
                name: "Not Found ",
                cause: "User Not Found in Database",
                message: errors.generateInvalidUserIdError(id),
                code: ErrorCodes.INVALID_TYPES_ERROR
            })
        }

        // Establezco la hora actual
        const fechaUTC = new Date()
        const desplazamientoHorario = -3 * 60 * 60 * 1000
        const fechaHoraArg = new Date(fechaUTC.getTime() + desplazamientoHorario)

        // Mando la hora y el user para al DAO para realizar la escritura en la DB
        const lastConnection = await this.dao.updateLastConnection(userId, fechaHoraArg)
        return lastConnection
    }

    // Borrar usuarios antiguos
    async deleteOldUsers() {

        const emails = []
        const dosDias = new Date()
        dosDias.setDate(dosDias.getDate() - 2)

        // Busco los usuarios que tengan una last_connection menor a la establecida.
        const usersToDelete = await UserModel.find(
            { last_connection: { $lt: dosDias } }
        )

        const deleteOldUsers = await this.dao.deleteOldUsers(dosDias)

        // Si el dao elimina uno o mas usuarios, les extraigo su email en un array para mandarles un correo.
        if (deleteOldUsers.deletedCount >= 1) {

            usersToDelete.forEach(user => {
                emails.push(user.email)
            })

            emails.forEach(email => {
                transport.sendMail({
                    from: "luccaroni@gmail.com",
                    to: `${email}`,
                    subject: "Cuenta eliminada por inactividad.",
                    html: `
                        <div>
                            <h2> Tu cuenta ha sido eliminada. </h2>
                            <p> Por inactividad y falta de conexión, tu cuenta fue eliminada de nuestro sistema. </p>
                            <p> Saludos. </p> 
                        </div>
                        `
                })
            })
        }
        return deleteOldUsers
    }

    // Borrar un usuario
    async deleteOneUser(userId) {

        const user = await this.getUserById(userId)
        if (!user) {
            throw CustomError.createError({
                name: "Not Found ",
                cause: "User Not Found in Database",
                message: errors.generateInvalidUserIdError(id),
                code: ErrorCodes.INVALID_TYPES_ERROR
            })
        }

        const deleteOneUser = await this.dao.deleteOneUser(userId)
        return deleteOneUser
    }

    // Cambiar el rol deun usuario (hecho por el admin)
    async changeRoleAdmin(userId) {

        const user = await this.getUserById(userId)
        if (!user) {
            throw CustomError.createError({
                name: "Not Found ",
                cause: "User Not Found in Database",
                message: errors.generateInvalidUserIdError(id),
                code: ErrorCodes.INVALID_TYPES_ERROR
            })
        }
        const userRole = user.role
        logger.debug(`Role: ${userRole}`)

        let newUserRole
        if (userRole === "user") {
            newUserRole = "premium"
        } else if (userRole === "premium") {
            newUserRole = "user"
        }

        // Mando al DAO la actualizacion de Rol
        const changeRole = await this.dao.changeRole(userId, newUserRole)
        return changeRole
    }
}

module.exports = { UsersService }