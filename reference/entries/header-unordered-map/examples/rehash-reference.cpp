#include <iostream>
#include <string>
#include <unordered_map>

int main() {
    std::unordered_map<std::string, std::string> states{
        {"primary", "ready"},
    };
    std::string& kept = states.at("primary");

    states.rehash(states.bucket_count() + 1);
    kept = "active";

    std::cout << states.at("primary") << '\n';
}
