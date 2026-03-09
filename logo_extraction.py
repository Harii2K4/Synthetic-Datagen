import  os
import  requests

providerWebsites= {
    "openai": "openai.com",
    "anthropic": "anthropic.com",
    "google": "google.com",
    "meta-llama": "meta.com",
    "mistralai": "mistral.ai",
    "cohere": "cohere.com",
    "ai21": "ai21.com",
    "inflection": "inflection.ai",
    "deepseek": "deepseek.com",
    "x-ai": "x.ai",
    "perplexity": "perplexity.ai",
    "nvidia": "nvidia.com",
    "microsoft": "microsoft.com",
    "amazon": "amazon.com",
    "ibm-granite": "ibm.com",
    "baidu": "baidu.com",
    "alibaba": "alibaba.com",
    "tencent": "tencent.com",
    "xiaomi": "mi.com",
    "moonshotai": "moonshot.cn",
    "minimax": "minimax.io",
    "qwen": "qwen.ai",
    "nousresearch": "nousresearch.com",
    "eleutherai": "eleuther.ai",
    "writer": "writer.com",
    "liquid": "liquid.ai",
    "upstage": "upstage.ai",
    "essentialai": "essential.ai",
    "arcee-ai": "arcee.ai",
    "cognitivecomputations": "cognitivecomputations.ai",
    "aion-labs": "aionlabs.ai",
    "deepcogito": "deepcogito.com",
    "stepfun": "stepfun.com",
    "prime-intellect": "primeintellect.ai",
    "switchpoint": "switchpoint.dev",
    "relace": "relace.ai",
    "z-ai": "z.ai",
    "mancer": "mancer.tech",
    "allenai": "allenai.org",
    "inception": "inceptionlabs.ai",
    "bytedance-seed": "bytedance.com",
    "kwaipilot": "streamlake.ai",
    "openrouter": "openrouter.ai",
    "huggingface":"huggingface.com"
}

LOGO_DEV_PUBLIC_KEY = '<YOUR_PUBLIC_KEY>'

def getCompanyLogo(domain, size=256):
    url = f"https://img.logo.dev/{domain}?token={LOGO_DEV_PUBLIC_KEY}&size={size}&format=png"
    response = requests.get(url)

    if response.status_code == 200:
        return response.content
    else:
        print(f"Failed to fetch logo for {domain}")
        return None


def saveLogo(provider_name, domain, folder="./frontend/final_project_frontend/src/assets/provider_logos"):
    os.makedirs(folder, exist_ok=True)

    image_bytes = getCompanyLogo(domain)

    if image_bytes:
        file_path = os.path.join(folder, f"{provider_name}.png")
        with open(file_path, "wb") as f:
            f.write(image_bytes)

        print(f"Saved: {file_path}")
    else:
        print(f"Skipping {provider_name}")

def main():
    for provider_name, domain in providerWebsites.items():
        saveLogo(provider_name, domain)
