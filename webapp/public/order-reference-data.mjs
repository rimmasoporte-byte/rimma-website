const activeRecord=row=>row?.status!=="inactive"&&row?.status!=="deleted";

export function createOrderReferenceData({
  api,
  getCurrentUserId=()=>"",
  getFallbackCurrency=()=>"EUR"
}){
  let branchRows=[];
  let categoryRows=[];
  let serviceRows=[];
  let memberRows=[];
  let defaultAssignee="";

  async function load(){
    const [catalogData,branchData,memberData]=await Promise.all([
      api("/price-list"),
      api("/branches"),
      api("/workspace/members")
    ]);

    const nextCategories=Array.isArray(catalogData?.priceList?.categories)
      ?catalogData.priceList.categories.filter(activeRecord)
      :[];
    const nextBranches=Array.isArray(branchData?.branches)
      ?branchData.branches.filter(branch=>branch?.status==="active")
      :[];
    const nextMembers=Array.isArray(memberData?.members)?memberData.members:[];
    const currentUserId=String(getCurrentUserId?.()||"");
    const nextDefaultAssignee=nextMembers.some(member=>member?.id===currentUserId)
      ?currentUserId
      :(nextMembers.length===1?String(nextMembers[0]?.id||""):"");
    const fallbackCurrency=String(getFallbackCurrency?.()||"EUR");
    const nextServices=nextCategories.flatMap(category=>
      (Array.isArray(category?.services)?category.services:[])
        .filter(activeRecord)
        .map(service=>({
          id:service.id,
          categoryId:category.id,
          name:service.name,
          label:String(category.name||"")+" \u00b7 "+String(service.name||""),
          priceMinor:service.priceMinor,
          pricingMode:service.pricingMode,
          currencyCode:service.currencyCode||fallbackCurrency
        }))
    );

    categoryRows=nextCategories;
    branchRows=nextBranches;
    memberRows=nextMembers;
    defaultAssignee=nextDefaultAssignee;
    serviceRows=nextServices;

    return snapshot();
  }

  const branches=()=>branchRows;
  const categories=()=>categoryRows;
  const services=()=>serviceRows;
  const members=()=>memberRows;
  const defaultAssignedUserId=()=>defaultAssignee;
  const snapshot=()=>({
    branches:branchRows,
    categories:categoryRows,
    services:serviceRows,
    members:memberRows,
    defaultAssignedUserId:defaultAssignee
  });

  return {
    load,
    branches,
    categories,
    services,
    members,
    defaultAssignedUserId,
    snapshot
  };
}
