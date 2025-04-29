const express = require("express");
const axios = require("axios");
const dotenv = require("dotenv");
const cors = require("cors");

dotenv.config();
const app = express();
app.use(express.json());
app.use(cors({
    origin: (origin, callback) => {
        console.log(`CORS check for origin: ${origin}`);
        if (!origin || origin.startsWith('https://travelai-server.onrender.com')) {
            callback(null, true);
        } else {
            console.error(`CORS rejected for origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    }
}));

let accessToken = null;
let tokenExpiration = 0;

const clientId = process.env.AMADEUS_API_KEY;
const clientSecret = process.env.AMADEUS_SECRET_KEY;
if (!clientId || !clientSecret) {
    console.error("Fatal: Missing AMADEUS_API_KEY or AMADEUS_SECRET_KEY");
    process.exit(1);
}

const getAccessToken = async () => {
    const currentTime = Math.floor(Date.now() / 1000);
    if (accessToken && tokenExpiration > currentTime + 60) {
        console.log("Using cached token");
        return accessToken;
    }

    console.log("--- Attempting to get new token ---");
    console.log("Client ID:", clientId);
    console.log("Client Secret:", clientSecret ? `Yes, length ${clientSecret.length}` : "No/Undefined");

    const params = new URLSearchParams();
    params.append("grant_type", "client_credentials");
    params.append("client_id", clientId);
    params.append("client_secret", clientSecret);

    try {
        const response = await axios.post(
            "https://test.api.amadeus.com/v1/security/oauth2/token",
            params,
            { timeout: 10000 }
        );
        accessToken = response.data.access_token;
        tokenExpiration = Math.floor(Date.now() / 1000) + response.data.expires_in - 60;
        console.log("--- Successfully obtained new token ---");
        return accessToken;
    } catch (error) {
        console.error("--- Error getting access token ---");
        console.error("Error:", error.message);
        if (error.response) {
            console.error("API Error Status:", error.response.status);
            console.error("API Error Details:", error.response.data);
        }
        throw error;
    }
};

app.get("/health", (req, res) => {
    console.log("Health check requested");
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

app.post("/v1/get-flight-prices", async (req, res) => {
    console.log("Request received for /v1/get-flight-prices:", JSON.stringify(req.body, null, 2));
    try {
        const { originLocationCode, destinationLocationCode, departureDate, adults, travelClass } = req.body;

        if (!originLocationCode || !destinationLocationCode || !departureDate || !adults || !travelClass) {
            console.error("Missing required fields:", req.body);
            return res.status(400).json({
                error: "Missing required fields",
                details: "Ensure originLocationCode, destinationLocationCode, departureDate, adults, and travelClass are provided"
            });
        }

        if (originLocationCode.length !== 3 || destinationLocationCode.length !== 3) {
            console.error("Invalid IATA codes:", { originLocationCode, destinationLocationCode });
            return res.status(400).json({
                error: "Invalid IATA codes",
                details: "originLocationCode and destinationLocationCode must be 3-letter IATA codes"
            });
        }

        if (!/^\d{4}-\d{2}-\d{2}$/.test(departureDate)) {
            console.error("Invalid date format:", departureDate);
            return res.status(400).json({
                error: "Invalid date format",
                details: "departureDate must be in YYYY-MM-DD format"
            });
        }

        console.log("Searching for flights with parameters:", {
            originLocationCode,
            destinationLocationCode,
            departureDate,
            travelClass,
            adults
        });

        const accessToken = await getAccessToken();

        const retry = async (fn, retries = 3, delay = 1000) => {
            for (let i = 0; i < retries; i++) {
                try {
                    return await fn();
                } catch (error) {
                    if (i === retries - 1 || !error.response || ![502, 503].includes(error.response.status)) {
                        throw error;
                    }
                    console.log(`Retrying Amadeus request (attempt ${i + 1})...`);
                    await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
                }
            }
        };

        const response = await retry(() => axios.get(
            "https://test.api.amadeus.com/v2/shopping/flight-offers",
            {
                params: {
                    originLocationCode,
                    destinationLocationCode,
                    departureDate,
                    adults,
                    children: "0",
                    travelClass
                },
                headers: { Authorization: `Bearer ${accessToken}` },
                timeout: 30000
            }
        ));

        console.log("Amadeus API response:", JSON.stringify(response.data, null, 2));
        const flightOffers = response.data.data || [];

        const structuredFlights = flightOffers.map((flight) => {
            console.log("Processing flight:", flight.id || "unknown id");
            const segment = flight.itineraries[0]?.segments[0];
            return {
                airline: segment?.carrierCode || "Unknown",
                price: flight.price?.total || "N/A",
                currency: flight.price?.currency || "USD",
                departureTime: segment?.departure?.at?.split("T")[1] || "N/A",
                departureDate: segment?.departure?.at?.split("T")[0] || "N/A",
                duration: flight.itineraries[0]?.duration || "N/A",
                stops: flight.itineraries[0]?.segments?.length - 1 || 0
            };
        });

        const topThreeFlights = structuredFlights
            .sort((a, b) => parseFloat(a.price) - parseFloat(b.price))
            .slice(0, 4);

        res.status(200).json({
            agent: "Alice",
            extractedInfo: { originLocationCode, destinationLocationCode, departureDate, travelClass, adults },
            top_flights: topThreeFlights
        });
    } catch (error) {
        console.error("Error fetching flight prices:", error.message);
        if (error.response) {
            console.error("API Error Details:", error.response.status, error.response.data);
            return res.status(error.response.status >= 500 ? 502 : error.response.status).json({
                error: "Failed to fetch flight prices",
                details: error.message,
                apiError: error.response.data || "No additional details"
            });
        }
        res.status(502).json({
            error: "Failed to fetch flight prices",
            details: error.message,
            apiError: "Server error or upstream issue"
        });
    }
});

const PORT = process.env.PORT || 8001;
const HOST = '0.0.0.0';
app.listen(PORT, HOST, () => {
    console.log(`Alice's Flight Agent started on http://${HOST}:${PORT}`);
    console.log("Environment check:", {
        AMADEUS_API_KEY: process.env.AMADEUS_API_KEY ? "set" : "missing",
        AMADEUS_SECRET_KEY: process.env.AMADEUS_SECRET_KEY ? "set" : "missing",
        PORT: process.env.PORT || "8001"
    });
});