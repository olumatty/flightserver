const express = require("express");
const axios = require("axios");
const dotenv = require("dotenv");

dotenv.config();
const app = express();
app.use(express.json());


// API Route to Get Flight Prices
app.post("/get-flight-prices", async (req, res) => {
    try {
        const { departure_location, destination, departure_date, flight_type, number_of_passengers } = req.body;

        const response = await axios.get("https://booking-com15.p.rapidapi.com/api/v1/flights/searchFlights", {
            params: {
                fromId: `${departure_location}.AIRPORT`,
                toId: `${destination}.AIRPORT`,
                departDate:departure_date,
                adults:number_of_passengers,
                travelClass:flight_type
            },
            headers: {
                "x-rapidapi-host": "booking-com15.p.rapidapi.com",
                "x-rapidapi-key": process.env.BOOKING_COM_API_KEY,
            }
        });

        const flightOffers = response.data.data.flightOffers || []

        const structuredFlight = flightOffers.map((flight) => ({
            airline:flight.airline,
            price:flight.price ? flight.price.total : "N/A",
            currency:flight.price ? flight.currency : "NGA",
            depatureTime:flight.depatureTime,
            arrivalTime: flight.arrivalTime,
            duration:flight.duration,
            stops:flight.stops,
            flightNumber:flight.flightNumber
        }));

        res.status(200).json({agent:"Alice", extractedInfo:{departure_location, destination, departure_date, flight_type, number_of_passengers }, flights:structuredFlight})
        console.log(flightOffers)
        console.log(structuredFlight)
    } catch (error) {
        console.error("Error fetching flight prices:", error.response?.data || error.message);
        res.status(500).json({ error: "Failed to fetch flight prices" });
    }
});

const PORT = 8001;
app.listen(PORT, () => {
    console.log(`Alice's Flight Agent is running on port ${PORT}`);
});
