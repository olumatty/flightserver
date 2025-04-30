const express = require("express");
const axios = require("axios");
const dotenv = require("dotenv");
const cors = require("cors");

dotenv.config();
const app = express();
app.use(express.json());
app.use(cors({
    origin: 'https://travelai-server.onrender.com'
}));


let accessToken = null;
let tokenExpiration = 0;


const getAccessToken = async () => {

    const currentTime = Math.floor(Date.now() / 1000);
    if (accessToken && tokenExpiration > currentTime + 60) {
        console.log("Using cached token");
        return accessToken;
    }
    const clientId = process.env.AMADEUS_API_KEY;
    const clientSecret = process.env.AMADEUS_SECRET_KEY;

    console.log("--- Attempting to get new token ---");
    console.log("Using Client ID:", clientId);
    console.log("Using Client Secret:", clientSecret ? `Yes, length ${clientSecret.length}` : "No/Undefined");
    
    const params = new URLSearchParams();
    params.append("grant_type", "client_credentials");
    params.append("client_id", clientId); 
    params.append("client_secret", clientSecret); 

    try {
        const response = await axios.post("https://test.api.amadeus.com/v1/security/oauth2/token", params);
        accessToken = response.data.access_token;
        tokenExpiration = Math.floor(Date.now() / 1000) + response.data.expires_in - 60;
        console.log("--- Successfully obtained new token ---"); 
        return accessToken;
    } catch (error) {
        console.error("--- Error getting access token ---"); 
        console.error("Error getting access token:", error.message);
        if (error.response) {
            console.error("API Error Status:", error.response.status); 
            console.error("API Error Details:", error.response.data); 
        }
        throw error;
    }
}
app.post("/v1/get-flight-prices", async (req, res) => {
    try {
        const {originLocationCode,destinationLocationCode,departureDate,adults,travelClass } = req.body;

        console.log("Searching for flights with parameters:", {
            originLocationCode,
            destinationLocationCode,
            departureDate,
            travelClass,
            adults
        });

        const accessToken = await getAccessToken();

        const response = await axios.get("https://test.api.amadeus.com/v2/shopping/flight-offers", {
            params: {
                originLocationCode:originLocationCode,
                destinationLocationCode:destinationLocationCode,
                departureDate:departureDate,
                adults: adults,
                children: "0",
                travelClass: travelClass
                
            },
            headers: {
                 Authorization: `Bearer ${accessToken}`,
            }
        });

        const flightOffers = response.data.data
        
        const structuredFlights = flightOffers.map((flight) => {
            console.log("Processing flight:", flight.id || "unknown id");
            const segment = flight.itineraries[0]?.segments[0]

            return{
                airline: segment?.carrierCode || "Unknown",
                price: flight.price?.total || "N/A",
                currency: flight.price?.currency || "USD",
                departureTime: segment?.departure?.at?.split("T")[1] || "N/A",
                departureDate: segment?.departure?.at?.split("T")[0] || "N/A",
                duration: flight.itineraries[0]?.duration || "N/A",
                stops: flight.itineraries[0]?.segments?.length - 1 || 0,
            }
        });

        const topThreeFlights = structuredFlights
            .sort((a, b) => a.price - b.price)
            .slice(0, 4);

        res.status(200).json({
            agent: "Alice",
            extractedInfo: {
                originLocationCode,
                destinationLocationCode,
                departureDate,
                travelClass,
                adults,
            },
            top_flights: topThreeFlights
        });

    } catch (error) {
        console.error("Error fetching flight prices:", error.message);
        if (error.response) {
            console.error("API Error Details:", error.response.status, error.response.data);
        }
        res.status(500).json({ 
            error: "Failed to fetch flight prices", 
            details: error.message,
            apiError: error.response?.data || "No additional details"
        });
        
    }
});
const PORT = 8001;
const HOST = '0.0.0.0';
app.listen(PORT, HOST, () => {
    console.log(`Alice's Flight Agent is running on port ${PORT}`);
});