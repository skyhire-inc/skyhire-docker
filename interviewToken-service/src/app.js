const express = require("express")
const app = express()
const dotenv = require("dotenv")
const cors = require("cors")
dotenv.config()

const generateEphemeralToken = require("./authgen")

app.use(cors())
app.use(express.json())

// Health check
app.get("/health", (req, res) => {
    res.json({ status: "ok", service: "auth-service" })
})

// Generate token
app.get("/token", async (req, res) => {
    try {
        const token = await generateEphemeralToken();
        res.json({
            success: true,
            token: {
                name: token.name,
                value: token.name.split("/")[1]
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err?.message || String(err) });
    }
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
    console.log(`Auth service listening on port ${PORT}`)
})