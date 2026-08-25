#include <iostream>
#include <map>
#include <string>

int main() {
    const std::map<std::string, int> scores{{"js", 15}, {"cpp", 20}};
    for (const auto& [language, score] : scores) {
        std::cout << language << '=' << score;
        if (language != scores.rbegin()->first) {
            std::cout << ' ';
        }
    }
    std::cout << '\n';
}
