const { GoogleGenAI } = require("@google/genai");

const token = process.env.GEMINI_API_LIVE_TOKEN;

if(!token || token.length === 0) {
    throw new Error("No GEMINI_API_LIVE_TOKEN environment variable");
}

const client = new GoogleGenAI({
    httpOptions: { apiVersion: "v1alpha" },
    apiKey: token
});
function generateEphemeralToken() {
    console.log("Loaded Gemini ... " + token.slice(0, 8))
    // Définir la durée d'expiration
    const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // +30 min
    const newSessionExpireTime = new Date(Date.now() + (1 * 60 * 1000)); // +1 min

    return new Promise((resolve, reject) => {
        client.authTokens.create({
            config: {
                uses: 5,  // nombre d'utilisations du token
                expireTime: expireTime,
                newSessionExpireTime: newSessionExpireTime,
                liveConnectConstraints: {
                    model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                    config: {
                        sessionResumption: {},
                        temperature: 0.7,
                        responseModalities: ['AUDIO']
                    }
                },
                httpOptions: { apiVersion: "v1alpha" }
            }
        }).then(token => {
            resolve(token);
        }).catch(reject)
    })
}

module.exports = generateEphemeralToken;