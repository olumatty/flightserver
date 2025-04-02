const express = require("express");
const axios = require("axios");
const dotenv = require("dotenv");

dotenv.config();
const app = express();
app.use(express.json());

app.post("/test-flight-api", async (req, res) => {
    try {
        const { departure_location, destination, departure_date, flight_type, number_of_passengers } = req.body;

        const response = await axios.get("https://booking-com15.p.rapidapi.com/api/v1/flights/searchFlights", {
            params: {
                fromId: `${departure_location}.AIRPORT`,
                toId: `${destination}.AIRPORT`,
                departDate: departure_date,
                adults: number_of_passengers,
                children: "0",
                travelClass: flight_type
            },
            headers: {
                "x-rapidapi-host": "booking-com15.p.rapidapi.com",
                "x-rapidapi-key": process.env.BOOKING_COM_API_KEY,
            }
        });

        // Return the raw API response
        res.status(200).json({
            apiResponse: response.data
        });
    } catch (error) {
        console.error("API Error:", error.message);
        if (error.response) {
            console.error("API Error Details:", error.response.data);
            res.status(500).json({ 
                error: "API Request Failed", 
                statusCode: error.response.status,
                details: error.response.data 
            });
        } else {
            res.status(500).json({ error: "Request Failed", details: error.message });
        }
    }
});

const PORT = 8001;
app.listen(PORT, () => {
    console.log(`Alice's Flight Agent is running on port ${PORT}`);
});