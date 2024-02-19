import express from 'express'
import logger from 'morgan'

import { Server } from 'socket.io'
import { createServer } from 'node:http'

import mysql from 'mysql2/promise'

const DEFAULT_CONFIG = {
  host: 'localhost',
  user: 'root',
  port: 3306,
  password: '',
  database: 'chat_db'
}

const connectionString = process.env.DATABASE_URL ?? DEFAULT_CONFIG

const connection = await mysql.createConnection(connectionString)

const port = process.env.PORT ?? 3000

const app = express()
const server = createServer(app)
const io = new Server(server, {
    connectionStateRecovery: {}
})

io.on('connection', async (socket) => {
    console.log('A user has connected')

    socket.on('disconnect', () => {
        console.log('A user has disconnected')
    })

    socket.on('chat message', async (msg) => {
        let result
        let username = socket.handshake.auth.username ?? 'anonymous'
        try {
            await connection.query(
                `INSERT INTO messages (content, user) VALUES (?, ?);`, [msg, username]
            )
            result = await connection.query(
                `SELECT LAST_INSERT_ID();`
            )
        } catch (e) {
            console.error(e)
            return
        }
        io.emit('chat message', msg, result[0], username)
    })

    if(!socket.recovered) { 
        try {
            const [messages] = await connection.query(
                `SELECT id, content, user FROM messages WHERE id > ?;`, [socket.handshake.auth.serverOffset ?? 0]
            )

            messages.forEach(element => {
                socket.emit('chat message', element.content, element.id.toString(), element.user)
            });
        } catch (e) {
            console.error(e)
        }
    }
})

app.use(logger('dev'))

app.get('/', (req, res) => {
    res.sendFile(process.cwd() + '/client/index.html')
})

server.listen(port, () => {
    console.log(`Server running on port ${port}`)
})