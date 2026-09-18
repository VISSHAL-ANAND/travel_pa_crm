// Travel-PA V2 core questionnaire definition.
// This is the client-approved questionnaire structure supplied for the new enquiry flow.
const CORE_QUESTIONNAIRE = {
  version: 2,
  title: "Let's start planning your holiday",
  subtitle: "This quick form takes around 3 minutes to complete. The more you tell us, the better we can tailor your holiday.",
  sections: [
    { id: "about_you", title: "About You" },
    { id: "your_trip", title: "Your Trip" },
    { id: "travellers", title: "Travellers" },
    { id: "budget", title: "Budget" },
    { id: "holiday_style", title: "Holiday Style" },
    { id: "preferences", title: "Preferences" },
    { id: "review", title: "Review" },
    { id: "submit", title: "Submit" }
  ],
  holidayTypes: [
    "Package Holiday","Tailor Made Holiday","Cruise","Villa","Tour","City Break",
    "Family Holiday","Honeymoon","Group Travel","Business Travel","Sports/Event Travel",
    "Ski Holiday","Safari","Luxury Holiday","Beach Holiday","Not Sure Yet"
  ],
  cruiseTypes: ["Ocean Cruise","River Cruise","Luxury Cruise","Family Cruise","Expedition Cruise"],
  sports: ["Football","Formula One","Golf","Tennis","Rugby","Cycling","Walking","Skiing","Horse Racing","Basketball","Cricket","Other"],
  holidayPreferences: [
    "Direct Flights","Luxury Hotel","Beachfront","Adults Only","Kids Club","Water Slides",
    "Golf","Spa","All Inclusive","Great Food","Walkable Resort","Private Pool",
    "Quiet Resort","Good Nightlife","Best Value","Luxury","Short Transfer"
  ],
  occasions: ["Honeymoon","Anniversary","Birthday","Wedding","Babymoon","Retirement","Family Celebration","No Occasion","Other"],
  roomTypes: ["Double","Twin","Family","Interconnecting","Close Together"],
  nights: ["5","7","10","11","14","21","Flexible","Other"],
  contactMethods: ["Phone","WhatsApp","Email"],
  bestTimes: ["Morning","Afternoon","Evening","Anytime"],
  referralSources: ["Google","Facebook","Referral","Repeat Customer","Website","Other"]
};

module.exports = { CORE_QUESTIONNAIRE };
