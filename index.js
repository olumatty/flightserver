const express = require("express");
const axios = require("axios");
const dotenv = require("dotenv");

dotenv.config();
const app = express();
app.use(express.json());


app.post("/get-flight-prices", async (req, res) => {
    try {
        const { departure_location, destination, departure_date, flight_type, number_of_passengers } = req.body;

        console.log("Searching for flights with parameters:", {
            departure_location,
            destination,
            departure_date,
            flight_type,
            number_of_passengers
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

        const flightOffers = response.data.data?.flightOffers || [];
        
        
        if (flightOffers.length > 0) {
            console.log("First flight offer keys:", Object.keys(flightOffers[0]));
        }

        function formatDateTime(dateTimeString) {
            if (!dateTimeString) {
                return "N/A";
            }
        
            const date = new Date(dateTimeString);
            if (isNaN(date)) {
                return "N/A"; // Invalid date
            }
        
            const options = {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
            };
        
            return date.toLocaleString('en-US', options);
        }
        
        function convertDurationToHours(durationInSeconds) {
            if (typeof durationInSeconds !== 'number') {
                return "N/A";
            }
        
            const hours = Math.floor(durationInSeconds / 3600);
            const minutes = Math.floor((durationInSeconds % 3600) / 60);
        
            return `${hours}h ${minutes}m`;
        }
        
        const structuredFlights = flightOffers.map((flight) => {
            console.log("Processing flight:", flight.id || "unknown id");
        
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
        
            
                if (flight.segments && flight.segments.length > 0) {
                    const firstSegment = flight.segments[0];

                    if (firstSegment.legs && firstSegment.legs[0] && firstSegment.legs[0].carriersData && firstSegment.legs[0].carriersData.length > 0 && firstSegment.legs[0].carriersData[0].name) {
                        flightData.airline = firstSegment.legs[0].carriersData[0].name;
                    } 

                flightData.flightNumber = firstSegment.legs?.[0]?.flightInfo?.flightNumber || "N/A";
                flightData.departureTime = formatDateTime(firstSegment.departureTime);
                flightData.arrivalTime = formatDateTime(firstSegment.arrivalTime);
                flightData.stops = 0;
        
                if (firstSegment.totalTime) {
                    flightData.duration = convertDurationToHours(firstSegment.totalTime);
                } else if (flight.totalDuration) {
                    flightData.duration = convertDurationToHours(flight.totalDuration);
                }
            }
            if (flight.totalPrice) {
                flightData.price = `${flight.totalPrice.units}.${Math.round(flight.totalPrice.nanos / 10000000)}`;
                flightData.currency = flight.totalPrice.currencyCode || "USD";
            } else if (flight.priceBreakdown && flight.priceBreakdown.total) {
                flightData.price = `${flight.priceBreakdown.total.units}.${Math.round(flight.priceBreakdown.total.nanos / 10000000)}`;
                flightData.currency = flight.priceBreakdown.total.currencyCode || "USD";
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
                number_of_passengers,
            },
            flights: structuredFlights
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
app.listen(PORT, () => {
    console.log(`Alice's Flight Agent is running on port ${PORT}`);
});