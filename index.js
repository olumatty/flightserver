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

        console.log("Searching flights with params:", {
            fromId: `${departure_location}.AIRPORT`,
            toId: `${destination}.AIRPORT`,
            departDate: departure_date,
            adults: number_of_passengers,
            children: "0", 
            travelClass: flight_type
        });

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

        console.log("Response data structure:", Object.keys(response.data));
        
        
        let flightOffers = [];
        
        if (response.data && response.data.data && response.data.data.flightOffers) {
            flightOffers = response.data.data.flightOffers;
        } else if (response.data && response.data.flightOffers) {
            flightOffers = response.data.flightOffers;
        } else if (response.data && Array.isArray(response.data)) {
            flightOffers = response.data;
        }
        
        console.log(`Found ${flightOffers.length} flight offers`);
        
        // If we have at least one flight, log its structure
        if (flightOffers.length > 0) {
            console.log("First flight structure:", JSON.stringify(flightOffers[0], null, 2).substring(0, 500));
        }

        const structuredFlight = flightOffers.map((flight) => {
            // Create a base object with default values
            const flightData = {
                airline: "Unknown",
                price: "N/A",
                currency: "USD",
                departureTime: "N/A",
                arrivalTime: "N/A",
                duration: "N/A",
                stops: 0,
                flightNumber: "N/A"
            };
            
            // Try to extract information using different possible paths
            try {
                // Airline information
                if (flight.airline) {
                    flightData.airline = flight.airline;
                } else if (flight.segments && flight.segments[0] && flight.segments[0].marketingCarrier) {
                    flightData.airline = flight.segments[0].marketingCarrier.name;
                }
                
                // Price information
                if (flight.price && flight.price.total) {
                    flightData.price = flight.price.total;
                    flightData.currency = flight.price.currency || "USD";
                } else if (flight.priceBreakdown) {
                    flightData.price = flight.priceBreakdown.total?.amount || "N/A";
                    flightData.currency = flight.priceBreakdown.total?.currencyCode || "USD";
                }
                
                // Time information
                if (flight.departureTime) {
                    flightData.departureTime = flight.departureTime;
                } else if (flight.segments && flight.segments[0]) {
                    flightData.departureTime = flight.segments[0].departure?.at || "N/A";
                }
                
                if (flight.arrivalTime) {
                    flightData.arrivalTime = flight.arrivalTime;
                } else if (flight.segments && flight.segments[flight.segments.length-1]) {
                    flightData.arrivalTime = flight.segments[flight.segments.length-1].arrival?.at || "N/A";
                }
                
                // Duration
                flightData.duration = flight.duration || "N/A";
                
                // Stops
                if (flight.stops !== undefined) {
                    flightData.stops = flight.stops;
                } else if (flight.segments) {
                    flightData.stops = flight.segments.length - 1;
                }
                
                // Flight number
                if (flight.flightNumber) {
                    flightData.flightNumber = flight.flightNumber;
                } else if (flight.segments && flight.segments[0]) {
                    flightData.flightNumber = flight.segments[0].number || "N/A";
                }
            } catch (err) {
                console.error("Error mapping flight data:", err);
            }
            
            return flightData;
        });

        res.status(200).json({
            agent: "Alice", 
            extractedInfo: {
                departure_location, 
                destination, 
                departure_date, 
                flight_type, 
                number_of_passengers 
            }, 
            flights: structuredFlight
        });
    } catch (error) {
        console.error("Error fetching flight prices:", error.response?.data || error.message);
        res.status(500).json({ error: "Failed to fetch flight prices", details: error.message });
    }
});

const PORT = 8001;
app.listen(PORT, () => {
    console.log(`Alice's Flight Agent is running on port ${PORT}`);
});