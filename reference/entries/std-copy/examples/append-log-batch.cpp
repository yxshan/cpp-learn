#include <algorithm>
#include <iostream>
#include <iterator>
#include <string>
#include <vector>

int main() {
    std::vector<std::string> logs{"boot", "ready"};
    const std::vector<std::string> request_logs{"request", "response"};
    std::copy(request_logs.begin(), request_logs.end(), std::back_inserter(logs));

    for (const auto& line : logs) {
        std::cout << line << '\n';
    }
}
