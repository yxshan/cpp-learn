#include <algorithm>
#include <iostream>
#include <string>
#include <vector>

int main() {
    std::vector<std::string> tags{"web", "api", "cache", "web", "api"};
    std::sort(tags.begin(), tags.end());
    const auto logical_end = std::unique(tags.begin(), tags.end());
    tags.erase(logical_end, tags.end());

    for (std::size_t index = 0; index < tags.size(); ++index) {
        std::cout << tags[index] << (index + 1 == tags.size() ? '\n' : ' ');
    }
}
