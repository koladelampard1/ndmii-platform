export function handoverDecision(input:{complete:boolean;officer:boolean;override:boolean;reason:string}){
  if(input.complete) return {allowed:true as const,override:false};
  if(!input.officer||!input.override) return {allowed:false as const,reason:"incomplete"};
  if(input.reason.trim().length<10) return {allowed:false as const,reason:"override_reason"};
  return {allowed:true as const,override:true};
}
export function validBankOutcome(input:{outcome:string;decisionDate:string;reason:string;approvedAmount:number|null;currency:string|null},now=Date.now()){
  const allowed=["facility_approved","declined","deferred","additional_information","withdrawn"];
  if(!allowed.includes(input.outcome)||Number.isNaN(Date.parse(input.decisionDate))||Date.parse(input.decisionDate)>now+86400000||
    input.reason.trim().length<3||input.reason.length>3000)return false;
  if(input.outcome==="facility_approved")return Boolean(input.approvedAmount&&input.approvedAmount>0&&input.currency&&/^[A-Z]{3}$/.test(input.currency));
  return input.approvedAmount===null&&input.currency===null;
}
